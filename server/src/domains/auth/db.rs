use chrono::{Duration, Utc};
use rand::RngExt;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::RegisterPayload;
use crate::{domains::users::models::Role, errors::AppError};

pub struct UserAuthInfo {
    pub id: Uuid,
    pub group_id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub role: Role,
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
        RETURNING id, group_id, email, password_hash, role AS "role: Role"
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
        SELECT id, group_id, email, password_hash, role AS "role: Role"
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
        SELECT 
            rt.id as token_id, 
            u.id as user_id, 
            u.group_id, 
            u.email, 
            u.password_hash, 
            u.role AS "role: Role", 
            rt.expires_at, 
            rt.revoked_at
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
        role: row.role,
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

/// Checks if an email has exceeded the maximum allowed failed attempts within the 5-minute lockout window.
pub async fn check_email_lockout(pool: &PgPool, email: &str) -> Result<(), AppError> {
    let fail_count: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM otp_fails
        WHERE LOWER(email) = LOWER($1)
          AND attempted_at > NOW() - INTERVAL '5 minutes'
        "#,
        email
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    if fail_count >= 5 {
        return Err(AppError::TooManyRequests(
            "Liian monta virheellistä yritystä. Kirjautuminen on lukittu 5 minuutiksi.".to_string(),
        ));
    }

    Ok(())
}

/// Records a failed OTP attempt and returns the updated count in the last 5 minutes.
pub async fn record_otp_fail(pool: &PgPool, email: &str) -> Result<i64, AppError> {
    sqlx::query!(
        r#"
        INSERT INTO otp_fails (email)
        VALUES ($1)
        "#,
        email
    )
    .execute(pool)
    .await?;

    let fail_count: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM otp_fails
        WHERE LOWER(email) = LOWER($1)
          AND attempted_at > NOW() - INTERVAL '5 minutes'
        "#,
        email
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    Ok(fail_count)
}

/// Clears all failed attempts for an email upon successful authentication.
pub async fn clear_otp_fails(pool: &PgPool, email: &str) -> Result<(), AppError> {
    sqlx::query!(
        r#"
        DELETE FROM otp_fails
        WHERE LOWER(email) = LOWER($1)
        "#,
        email
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Generates a 6-digit random code, invalidates previous codes, hashes the new code,
/// and stores the hash in the database. Returns the plain raw code so it can be emailed to the user.
pub async fn create_otp_code(pool: &PgPool, email: &str) -> Result<String, AppError> {
    // 1. Check if email is currently locked out
    check_email_lockout(pool, email).await?;

    // 2. Invalidate any prior unused OTP codes for this email
    sqlx::query!(
        r#"
        UPDATE otp_codes
        SET used_at = NOW()
        WHERE LOWER(email) = LOWER($1) AND used_at IS NULL
        "#,
        email
    )
    .execute(pool)
    .await?;

    // 3. Generate new 6-digit numeric code
    let raw_code: String = {
        let mut rng = rand::rng();
        (0..6)
            .map(|_| rng.random_range(0..=9).to_string())
            .collect()
    };

    let code_hash = sha256_hash(&raw_code);

    tracing::info!("[OTP CREATE] Generated new OTP code for email: '{}'", email);

    sqlx::query!(
        r#"
        INSERT INTO otp_codes (email, code_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
        "#,
        email,
        code_hash
    )
    .execute(pool)
    .await?;

    Ok(raw_code)
}

/// Verify provided raw code against its hash, consume it, and fetch corresponding user info.
/// Enforces lockout if 5 or more failed attempts occur within 5 minutes.
pub async fn verify_and_consume_otp(
    pool: &PgPool,
    email: &str,
    raw_code: &str,
) -> Result<UserAuthInfo, AppError> {
    // 1. Check if email is locked out
    check_email_lockout(pool, email).await?;

    let code_hash = sha256_hash(raw_code);

    tracing::info!("[OTP VERIFY] Attempting verification for email: '{}'", email);

    let row = sqlx::query!(
        r#"
        SELECT id, expires_at, used_at
        FROM otp_codes
        WHERE LOWER(email) = LOWER($1) AND code_hash = $2 AND used_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        "#,
        email,
        code_hash
    )
    .fetch_optional(pool)
    .await?;

    // If no active matching code is found or if it is already expired
    let row = match row {
        Some(r) if r.expires_at >= Utc::now() => r,
        _ => {
            let fail_count = record_otp_fail(pool, email).await?;
            if fail_count >= 5 {
                tracing::warn!(
                    "[OTP VERIFY] Max attempts reached for email: '{}'. Locking for 5 minutes.",
                    email
                );
                return Err(AppError::TooManyRequests(
                    "Liian monta virheellistä yritystä. Kirjautuminen on lukittu 5 minuutiksi.".to_string(),
                ));
            } else {
                let remaining = 5 - fail_count;
                tracing::warn!(
                    "[OTP VERIFY] Failed verification for email: '{}'. {} attempts remaining.",
                    email,
                    remaining
                );
                return Err(AppError::Unauthorized(format!(
                    "Virheellinen tai vanhentunut koodi. Yrityksiä jäljellä: {remaining}."
                )));
            }
        }
    };

    // Mark code as used
    sqlx::query!("UPDATE otp_codes SET used_at = NOW() WHERE id = $1", row.id)
        .execute(pool)
        .await?;

    // Clear failed attempts counter on successful login
    clear_otp_fails(pool, email).await?;

    // Find and return active user
    let user = find_user_by_email(pool, email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Käyttäjää ei löytynyt.".to_string()))?;

    Ok(user)
}

fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}
