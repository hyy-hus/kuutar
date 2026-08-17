use axum::{Json, extract::State, http::StatusCode};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use super::{
    db, jwt,
    models::{AuthTokens, LoginPayload, RefreshPayload, RegisterPayload},
    password,
};
use crate::{config::Config, errors::AppError};

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

    let tokens = issue_token_pair(&state, user.id, user.group_id).await?;
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

    let tokens = issue_token_pair(&state, user.id, user.group_id).await?;
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

    let tokens = issue_token_pair(&state, user.id, user.group_id).await?;
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
) -> Result<AuthTokens, AppError> {
    let access_token = jwt::encode_jwt(
        user_id,
        group_id,
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
