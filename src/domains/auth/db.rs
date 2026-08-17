use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::RegisterPayload;
use crate::errors::AppError;

pub struct UserAuthInfo {
    pub id: Uuid,
    pub group_id: Uuid,
    pub email: String,
    pub password_hash: String,
}

/// Create a new user during registration
pub async fn create_user(
    pool: &PgPool,
    payload: &RegisterPayload,
    hashed_password: &str,
) -> Result<UserAuthInfo, AppError> {
    let user = sqlx::query_as!(
        UserAuthInfo,
        r#"
        INSERT INTO users (group_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, group_id, email, password_hash
        "#,
        payload.group_id,
        payload.email.to_lowercase(),
        hashed_password
    )
    .fetch_one(pool)
    .await?;

    Ok(user)
}

/// Lookup active user by email for login
pub async fn find_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<UserAuthInfo>, AppError> {
    let user = sqlx::query_as!(
        UserAuthInfo,
        r#"
        SELECT id, group_id, email, password_hash
        FROM users
        WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
        "#,
        email
    )
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Insert a new refresh token (hashed)
pub async fn create_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    raw_refresh_token: &str,
    ttl_days: i64,
) -> Result<(), AppError> {
    let token_hash = sha256_hash(raw_refresh_token);
    let expires_at = Utc::now() + Duration::days(ttl_days);

    sqlx::query!(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_id,
        token_hash,
        expires_at
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Verify an unrevoked and non-expired refresh token and retrieve user info
pub async fn verify_and_consume_refresh_token(
    pool: &PgPool,
    raw_refresh_token: &str,
) -> Result<UserAuthInfo, AppError> {
    let token_hash = sha256_hash(raw_refresh_token);

    // Fetch token + user
    let row = sqlx::query!(
        r#"
        SELECT rt.id as token_id, u.id as user_id, u.group_id, u.email, u.password_hash, rt.expires_at, rt.revoked_at
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1 AND u.deleted_at IS NULL
        "#,
        token_hash
    )
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;

    if row.revoked_at.is_some() || row.expires_at < Utc::now() {
        return Err(AppError::Unauthorized(
            "Refresh token expired or revoked".to_string(),
        ));
    }

    // Revoke the used refresh token (Token Rotation pattern)
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
        row.token_id
    )
    .execute(pool)
    .await?;

    Ok(UserAuthInfo {
        id: row.user_id,
        group_id: row.group_id,
        email: row.email,
        password_hash: row.password_hash,
    })
}

/// Revoke a specific refresh token (Logout)
pub async fn revoke_refresh_token(pool: &PgPool, raw_refresh_token: &str) -> Result<(), AppError> {
    let token_hash = sha256_hash(raw_refresh_token);

    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1",
        token_hash
    )
    .execute(pool)
    .await?;

    Ok(())
}

fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}
