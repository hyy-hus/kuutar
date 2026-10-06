use crate::utils::mail;
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header::USER_AGENT},
};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    extractor::AuthUser,
    jwt,
    models::{AuthTokens, LoginPayload, RefreshPayload, RegisterPayload, SessionInfo},
    password,
};
use crate::{
    config::Config,
    domains::{
        auth::models::{RequestOtpPayload, VerifyOtpPayload},
        email_templates::notify,
    },
    errors::AppError,
};

#[derive(Clone)]
pub struct AuthState {
    pub pool: PgPool,
    pub config: Config,
}

/// Register a new user
#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "Auth",
    request_body = RegisterPayload,
    responses(
        (status = 201, description = "User registered successfully", body = AuthTokens),
        (status = 409, description = "Email already registered"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(state, headers))]
pub async fn register(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(payload): Json<RegisterPayload>,
) -> Result<(StatusCode, Json<AuthTokens>), AppError> {
    payload.validate()?;

    let password_hash = password::hash_password(&payload.password)?;
    let user = db::create_user(&state.pool, &payload, &password_hash).await?;
    notify::spawn_welcome_email(&state.pool, &state.config, user.id);

    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(tokens)))
}

/// Login with email and password
#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Auth",
    request_body = LoginPayload,
    responses(
        (status = 200, description = "Login successful", body = AuthTokens),
        (status = 401, description = "Invalid credentials")
    )
)]
#[tracing::instrument(skip(state, headers))]
pub async fn login(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    payload.validate()?;

    let user = db::find_user_by_email(&state.pool, &payload.email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid email or password".to_string()))?;

    let valid = password::verify_password(&payload.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized(
            "Invalid email or password".to_string(),
        ));
    }

    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers),
    )
    .await?;
    Ok(Json(tokens))
}

/// Exchange a valid Refresh Token for a new Access + Refresh Token pair
#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "Auth",
    request_body = RefreshPayload,
    responses(
        (status = 200, description = "Token refreshed successfully", body = AuthTokens),
        (status = 401, description = "Invalid or expired refresh token")
    )
)]
#[tracing::instrument(skip(state, headers))]
pub async fn refresh(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(payload): Json<RefreshPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    // Validates refresh token & revokes it (Token Rotation)
    let (user, session, previous) =
        db::verify_and_consume_refresh_token(&state.pool, &payload.refresh_token).await?;

    // Keep the device info of the session when this request does not carry any
    let current = session_meta(&headers);
    let meta = db::SessionMeta {
        user_agent: current.user_agent.or(previous.user_agent),
        ip: current.ip.or(previous.ip),
    };

    // Group and role are re-read from the DB, so refreshing picks up admin changes
    let tokens = issue_token_pair(&state, &user, session, &meta).await?;
    Ok(Json(tokens))
}

/// Logout (Revoke refresh token)
#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Auth",
    request_body = RefreshPayload,
    responses(
        (status = 204, description = "Logged out successfully")
    )
)]
#[tracing::instrument(skip(state))]
pub async fn logout(
    State(state): State<AuthState>,
    Json(payload): Json<RefreshPayload>,
) -> Result<StatusCode, AppError> {
    db::revoke_refresh_token(&state.pool, &payload.refresh_token).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Helper function to create access JWT + store new random refresh token in `session`
async fn issue_token_pair(
    state: &AuthState,
    user: &db::UserAuthInfo,
    session: db::SessionRef,
    meta: &db::SessionMeta,
) -> Result<AuthTokens, AppError> {
    let access_token = jwt::encode_jwt_for_session(
        user.id,
        user.group_id,
        user.role,
        Some(session.id),
        &state.config.jwt_secret,
        state.config.jwt_expiration_seconds,
    )?;

    let raw_refresh_token = format!("{}{}", Uuid::new_v4(), Uuid::new_v4());

    db::create_refresh_token(&state.pool, user.id, &raw_refresh_token, session, meta).await?;

    Ok(AuthTokens {
        access_token,
        refresh_token: raw_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration_seconds,
    })
}

/// User agent and client IP of a request. The IP is only known behind a proxy that sets
/// `X-Forwarded-For`.
fn session_meta(headers: &HeaderMap) -> db::SessionMeta {
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|ua| ua.chars().take(200).collect());
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|ip| ip.trim().chars().take(45).collect::<String>())
        .filter(|ip| !ip.is_empty());
    db::SessionMeta { user_agent, ip }
}

pub fn to_session_info(
    sessions: Vec<db::ActiveSession>,
    current: Option<Uuid>,
) -> Vec<SessionInfo> {
    sessions
        .into_iter()
        .map(|s| SessionInfo {
            session_id: s.session_id,
            started_at: s.started_at,
            last_active_at: s.last_active_at,
            expires_at: s.expires_at,
            user_agent: s.user_agent,
            ip: s.ip,
            current: current == Some(s.session_id),
        })
        .collect()
}

/// List the current user's active sessions
#[utoipa::path(
    get,
    path = "/auth/sessions",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses((status = 200, description = "Active sessions", body = [SessionInfo]))
)]
pub async fn list_my_sessions(
    State(state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<SessionInfo>>, AppError> {
    let sessions = db::list_sessions(&state.pool, auth_user.id).await?;
    Ok(Json(to_session_info(sessions, auth_user.session_id)))
}

/// End one of the current user's sessions
#[utoipa::path(
    delete,
    path = "/auth/sessions/{session_id}",
    tag = "Auth",
    security(("bearer_auth" = [])),
    params(("session_id" = Uuid, Path, description = "Session ID")),
    responses(
        (status = 204, description = "Session ended"),
        (status = 404, description = "Session not found")
    )
)]
pub async fn revoke_my_session(
    State(state): State<AuthState>,
    auth_user: AuthUser,
    Path(session_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::revoke_session(&state.pool, auth_user.id, session_id, "logout").await?;
    Ok(StatusCode::NO_CONTENT)
}

/// End all of the current user's other sessions (the current one stays logged in)
#[utoipa::path(
    post,
    path = "/auth/logout-others",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses((status = 204, description = "Other sessions ended"))
)]
pub async fn logout_other_sessions(
    State(state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<StatusCode, AppError> {
    db::revoke_all_sessions(&state.pool, auth_user.id, "logout", auth_user.session_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Request OTP Login Code via Email
#[utoipa::path(
    post,
    path = "/auth/otp/request",
    tag = "Auth",
    request_body = RequestOtpPayload,
    responses(
        (status = 200, description = "OTP sent to email if account exists"),
        (status = 422, description = "Validation error"),
        (status = 429, description = "Account temporarily locked due to too many failed attempts")
    )
)]
#[tracing::instrument(skip(state))]
pub async fn request_otp(
    State(state): State<AuthState>,
    Json(payload): Json<RequestOtpPayload>,
) -> Result<axum::http::StatusCode, AppError> {
    payload.validate()?;

    // Check if account is locked out due to too many failed attempts
    db::check_email_lockout(&state.pool, &payload.email).await?;

    if let Some(user) = db::find_user_by_email(&state.pool, &payload.email).await? {
        let raw_code = db::create_otp_code(&state.pool, &user.email).await?;

        if state.config.smtp_host.is_some() {
            mail::send_otp_email(&state.config, &user.email, &raw_code).await?;
        } else {
            tracing::warn!(
                "SMTP_HOST missing in config! Could not send OTP email to {}",
                user.email
            );
        }
    }

    Ok(axum::http::StatusCode::OK)
}

/// Verify OTP Login Code and Issue Access Token
#[utoipa::path(
    post,
    path = "/auth/otp/verify",
    tag = "Auth",
    request_body = VerifyOtpPayload,
    responses(
        (status = 200, description = "OTP verified successfully", body = AuthTokens),
        (status = 401, description = "Invalid or expired OTP code"),
        (status = 429, description = "Account temporarily locked due to too many failed attempts")
    )
)]
#[tracing::instrument(skip(state, headers))]
pub async fn verify_otp(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(payload): Json<VerifyOtpPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    payload.validate()?;

    let user = db::verify_and_consume_otp(&state.pool, &payload.email, &payload.code).await?;
    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers),
    )
    .await?;

    Ok(Json(tokens))
}
