use crate::utils::mail;
use axum::{Json, extract::State, http::StatusCode};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use super::{
    db, jwt,
    models::{AuthTokens, LoginPayload, RefreshPayload, RegisterPayload},
    password,
};
use crate::{
    config::Config,
    domains::{
        auth::models::{RequestOtpPayload, VerifyOtpPayload},
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
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(state))]
pub async fn register(
    State(state): State<AuthState>,
    Json(payload): Json<RegisterPayload>,
) -> Result<(StatusCode, Json<AuthTokens>), AppError> {
    payload.validate()?;

    let password_hash = password::hash_password(&payload.password)?;
    let user = db::create_user(&state.pool, &payload, &password_hash).await?;

    let tokens = issue_token_pair(&state, user.id, user.group_id, user.role).await?;
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
#[tracing::instrument(skip(state))]
pub async fn login(
    State(state): State<AuthState>,
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

    let tokens = issue_token_pair(&state, user.id, user.group_id, user.role).await?;
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
#[tracing::instrument(skip(state))]
pub async fn refresh(
    State(state): State<AuthState>,
    Json(payload): Json<RefreshPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    // Validates refresh token & revokes it (Token Rotation)
    let user = db::verify_and_consume_refresh_token(&state.pool, &payload.refresh_token).await?;

    let tokens = issue_token_pair(&state, user.id, user.group_id, user.role).await?;
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

/// Helper function to create access JWT + store new random refresh token
async fn issue_token_pair(
    state: &AuthState,
    user_id: Uuid,
    group_id: Uuid,
    role: Role,
) -> Result<AuthTokens, AppError> {
    let access_token = jwt::encode_jwt(
        user_id,
        group_id,
        role,
        &state.config.jwt_secret,
        state.config.jwt_expiration_seconds,
    )?;

    let raw_refresh_token = format!("{}{}", Uuid::new_v4(), Uuid::new_v4());

    db::create_refresh_token(&state.pool, user_id, &raw_refresh_token, 7).await?;

    Ok(AuthTokens {
        access_token,
        refresh_token: raw_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration_seconds,
    })
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
#[tracing::instrument(skip(state))]
pub async fn verify_otp(
    State(state): State<AuthState>,
    Json(payload): Json<VerifyOtpPayload>,
) -> Result<Json<AuthTokens>, AppError> {
    payload.validate()?;

    let user = db::verify_and_consume_otp(&state.pool, &payload.email, &payload.code).await?;
    let tokens = issue_token_pair(&state, user.id, user.group_id, user.role).await?;

    Ok(Json(tokens))
}
