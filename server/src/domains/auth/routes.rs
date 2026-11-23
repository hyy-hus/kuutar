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
    extractor::{ClientIp, RequireAdmin, RequireOwnAccount},
    jwt,
    models::{AuthTokens, LoginPayload, RefreshPayload, RegisterPayload, SessionInfo},
    password,
    rate_limit::{self, email_key},
};
use crate::{
    config::Config,
    domains::{
        auth::models::{RequestOtpPayload, VerifyOtpPayload},
        email_templates::notify,
        users::models::Role,
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
        (status = 422, description = "Validation error"),
        (status = 429, description = "Too many registrations from this address")
    )
)]
#[tracing::instrument(skip(state, headers, ip))]
pub async fn register(
    State(state): State<AuthState>,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    Json(payload): Json<RegisterPayload>,
) -> Result<(StatusCode, Json<AuthTokens>), AppError> {
    payload.validate()?;
    rate_limit::check(&state.pool, rate_limit::REGISTER_IP, ip.as_deref()).await?;
    rate_limit::record(&state.pool, rate_limit::REGISTER_IP, ip.as_deref()).await?;

    let password_hash = password::hash_password(&payload.password)?;
    let user = db::create_user(&state.pool, &payload, &password_hash).await?;
    notify::spawn_welcome_email(&state.pool, &state.config, user.id);

    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers, ip),
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
        (status = 401, description = "Invalid credentials"),
        (status = 429, description = "Too many failed attempts for this email or address")
    )
)]
#[tracing::instrument(skip(state, headers, ip))]
pub async fn login(
    State(state): State<AuthState>,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    payload.validate()?;

    // Checked before the (slow) password hash, and whether or not the account exists
    let email = email_key(&payload.email);
    rate_limit::check(&state.pool, rate_limit::LOGIN_EMAIL, Some(&email)).await?;
    rate_limit::check(&state.pool, rate_limit::LOGIN_IP, ip.as_deref()).await?;

    let user = match db::find_user_by_email(&state.pool, &payload.email).await? {
        Some(user) if password::verify_password(&payload.password, &user.password_hash)? => user,
        _ => {
            rate_limit::record(&state.pool, rate_limit::LOGIN_EMAIL, Some(&email)).await?;
            rate_limit::record(&state.pool, rate_limit::LOGIN_IP, ip.as_deref()).await?;
            return Err(AppError::Unauthorized(
                "Invalid email or password".to_string(),
            ));
        }
    };
    rate_limit::clear(&state.pool, rate_limit::LOGIN_EMAIL, &email).await?;

    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers, ip),
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
        (status = 401, description = "Invalid or expired refresh token"),
        (status = 429, description = "Too many refreshes from this address")
    )
)]
#[tracing::instrument(skip(state, headers, ip, payload))]
pub async fn refresh(
    State(state): State<AuthState>,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    Json(payload): Json<RefreshPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    rate_limit::check(&state.pool, rate_limit::REFRESH_IP, ip.as_deref()).await?;
    rate_limit::record(&state.pool, rate_limit::REFRESH_IP, ip.as_deref()).await?;

    // Validates refresh token & revokes it (Token Rotation)
    let (user, session, previous) =
        db::verify_and_consume_refresh_token(&state.pool, &payload.refresh_token).await?;

    // Keep the device info of the session when this request does not carry any
    let current = session_meta(&headers, ip);
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
        session.impersonator_id,
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

/// User agent and client IP (from the `ClientIp` extractor) of a request
fn session_meta(headers: &HeaderMap, ip: Option<String>) -> db::SessionMeta {
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|ua| ua.chars().take(200).collect());
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
            impersonated_by: s.impersonator_id,
        })
        .collect()
}

/// List the current user's active sessions
#[utoipa::path(
    get,
    path = "/auth/sessions",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Active sessions", body = [SessionInfo]),
        (status = 403, description = "Not allowed while acting as another user")
    )
)]
pub async fn list_my_sessions(
    State(state): State<AuthState>,
    RequireOwnAccount(auth_user): RequireOwnAccount,
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
    RequireOwnAccount(auth_user): RequireOwnAccount,
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
    RequireOwnAccount(auth_user): RequireOwnAccount,
) -> Result<StatusCode, AppError> {
    db::revoke_all_sessions(&state.pool, auth_user.id, "logout", auth_user.session_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Start acting as another user (admin only). Returns tokens for a session as that user,
/// marked with the admin's id and capped at one hour.
#[utoipa::path(
    post,
    path = "/auth/impersonate/{user_id}",
    tag = "Auth",
    security(("bearer_auth" = [])),
    params(("user_id" = Uuid, Path, description = "User to act as")),
    responses(
        (status = 200, description = "Impersonation session started", body = AuthTokens),
        (status = 403, description = "Not an admin, or the target is an admin or yourself"),
        (status = 404, description = "User not found")
    )
)]
#[tracing::instrument(skip(state, headers, ip))]
pub async fn start_impersonation(
    State(state): State<AuthState>,
    RequireAdmin(admin): RequireAdmin,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<Json<AuthTokens>, AppError> {
    if user_id == admin.id {
        return Err(AppError::Forbidden(
            "You cannot act as yourself".to_string(),
        ));
    }
    let target = db::find_user_by_id(&state.pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    if target.role != Role::User {
        return Err(AppError::Forbidden(
            "Admins cannot act as other admins".to_string(),
        ));
    }

    let tokens = issue_token_pair(
        &state,
        &target,
        db::SessionRef::impersonation(admin.id),
        &session_meta(&headers, ip),
    )
    .await?;
    tracing::info!(admin_id = %admin.id, user_id = %target.id, "Impersonation started");
    Ok(Json(tokens))
}

/// End an impersonation session. The client then switches back to the admin's own tokens.
#[utoipa::path(
    post,
    path = "/auth/impersonate/end",
    tag = "Auth",
    request_body = RefreshPayload,
    responses(
        (status = 204, description = "Impersonation session ended"),
        (status = 404, description = "Not an active impersonation session")
    )
)]
#[tracing::instrument(skip(state, payload))]
pub async fn end_impersonation(
    State(state): State<AuthState>,
    Json(payload): Json<RefreshPayload>,
) -> Result<StatusCode, AppError> {
    db::end_impersonation(&state.pool, &payload.refresh_token).await?;
    tracing::info!("Impersonation ended");
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
        (status = 429, description = "Too many code requests or failed attempts")
    )
)]
#[tracing::instrument(skip(state, ip))]
pub async fn request_otp(
    State(state): State<AuthState>,
    ClientIp(ip): ClientIp,
    Json(payload): Json<RequestOtpPayload>,
) -> Result<axum::http::StatusCode, AppError> {
    payload.validate()?;

    // Counted whether or not the account exists, so the limit reveals nothing about it
    let email = email_key(&payload.email);
    rate_limit::check(&state.pool, rate_limit::OTP_REQUEST_EMAIL, Some(&email)).await?;
    rate_limit::check(&state.pool, rate_limit::OTP_REQUEST_IP, ip.as_deref()).await?;
    rate_limit::record(&state.pool, rate_limit::OTP_REQUEST_EMAIL, Some(&email)).await?;
    rate_limit::record(&state.pool, rate_limit::OTP_REQUEST_IP, ip.as_deref()).await?;

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
#[tracing::instrument(skip(state, headers, ip))]
pub async fn verify_otp(
    State(state): State<AuthState>,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    Json(payload): Json<VerifyOtpPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    payload.validate()?;
    rate_limit::check(&state.pool, rate_limit::OTP_VERIFY_IP, ip.as_deref()).await?;

    let user = match db::verify_and_consume_otp(&state.pool, &payload.email, &payload.code).await {
        Ok(user) => user,
        Err(err) => {
            if matches!(err, AppError::Unauthorized(_)) {
                rate_limit::record(&state.pool, rate_limit::OTP_VERIFY_IP, ip.as_deref()).await?;
            }
            return Err(err);
        }
    };
    let tokens = issue_token_pair(
        &state,
        &user,
        db::SessionRef::new(),
        &session_meta(&headers, ip),
    )
    .await?;

    Ok(Json(tokens))
}
