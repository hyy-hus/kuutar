use chrono::{DateTime, Duration, Utc};
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

/// Idle lifetime of a single refresh token
const REFRESH_TOKEN_TTL_DAYS: i64 = 7;
/// Absolute lifetime of a session, however often it is refreshed
const SESSION_MAX_DAYS: i64 = 30;
/// A rotated token replayed within this window is treated as a refresh race (e.g. two
/// tabs sharing one stored token), not theft
const REUSE_GRACE_SECONDS: i64 = 30;

/// Where a session was started from, shown in session lists
#[derive(Debug, Default, Clone)]
pub struct SessionMeta {
    pub user_agent: Option<String>,
    pub ip: Option<String>,
}

/// The session a refresh token belongs to
#[derive(Debug, Clone, Copy)]
pub struct SessionRef {
    pub id: Uuid,
    pub started_at: DateTime<Utc>,
}

impl SessionRef {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            started_at: Utc::now(),
        }
    }
}

impl Default for SessionRef {
    fn default() -> Self {
        Self::new()
    }
}

/// An active session as shown to the user or an admin
#[derive(Debug)]
pub struct ActiveSession {
    pub session_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
}

/// Insert a new refresh token (hashed) belonging to `session`
pub async fn create_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    raw_refresh_token: &str,
    session: SessionRef,
    meta: &SessionMeta,
) -> Result<(), AppError> {
    let token_hash = sha256_hash(raw_refresh_token);
    // Sliding idle window, capped by the session's absolute lifetime
    let expires_at = (Utc::now() + Duration::days(REFRESH_TOKEN_TTL_DAYS))
        .min(session.started_at + Duration::days(SESSION_MAX_DAYS));

    sqlx::query!(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, session_id, session_started_at, user_agent, ip)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
        user_id,
        token_hash,
        expires_at,
        session.id,
        session.started_at,
        meta.user_agent,
        meta.ip
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Atomically consume a valid refresh token (rotation) and return its user and session.
///
/// A token that was already rotated and is replayed after the grace window means two
/// parties hold the same chain, so the whole session is revoked.
pub async fn verify_and_consume_refresh_token(
    pool: &PgPool,
    raw_refresh_token: &str,
) -> Result<(UserAuthInfo, SessionRef, SessionMeta), AppError> {
    let token_hash = sha256_hash(raw_refresh_token);

    let row = sqlx::query!(
        r#"
        UPDATE refresh_tokens rt
        SET revoked_at = NOW(), revoked_reason = 'rotated'
        FROM users u
        WHERE rt.token_hash = $1
          AND rt.revoked_at IS NULL
          AND rt.expires_at > NOW()
          AND u.id = rt.user_id
          AND u.deleted_at IS NULL
        RETURNING
            rt.session_id,
            rt.session_started_at,
            rt.user_agent,
            rt.ip,
            u.id AS user_id,
            u.group_id,
            u.email,
            u.password_hash,
            u.role AS "role: Role"
        "#,
        token_hash
    )
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        revoke_session_on_reuse(pool, &token_hash).await?;
        return Err(AppError::Unauthorized(
            "Refresh token invalid, expired or revoked".to_string(),
        ));
    };

    Ok((
        UserAuthInfo {
            id: row.user_id,
            group_id: row.group_id,
            email: row.email,
            password_hash: row.password_hash,
            role: row.role,
        },
        SessionRef {
            id: row.session_id,
            started_at: row.session_started_at,
        },
        SessionMeta {
            user_agent: row.user_agent,
            ip: row.ip,
        },
    ))
}

/// Revokes the whole session if `token_hash` is a long-rotated token being replayed
async fn revoke_session_on_reuse(pool: &PgPool, token_hash: &str) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'reuse'
        WHERE revoked_at IS NULL
          AND session_id = (
              SELECT session_id FROM refresh_tokens
              WHERE token_hash = $1
                AND revoked_reason = 'rotated'
                AND revoked_at < NOW() - make_interval(secs => $2)
          )
        "#,
        token_hash,
        REUSE_GRACE_SECONDS as f64
    )
    .execute(pool)
    .await?;

    if result.rows_affected() > 0 {
        tracing::warn!("Refresh token reuse detected; session revoked");
    }
    Ok(())
}

/// Revoke the session a refresh token belongs to (Logout)
pub async fn revoke_refresh_token(pool: &PgPool, raw_refresh_token: &str) -> Result<(), AppError> {
    let token_hash = sha256_hash(raw_refresh_token);

    sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'logout'
        WHERE revoked_at IS NULL
          AND session_id = (SELECT session_id FROM refresh_tokens WHERE token_hash = $1)
        "#,
        token_hash
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Revoke one session of a user. Returns NotFound if it is not active.
pub async fn revoke_session(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = $3
        WHERE user_id = $1 AND session_id = $2 AND revoked_at IS NULL
        "#,
        user_id,
        session_id,
        reason
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Revoke every active session of a user, optionally sparing one. Returns the number of
/// tokens revoked.
pub async fn revoke_all_sessions(
    executor: impl sqlx::PgExecutor<'_>,
    user_id: Uuid,
    reason: &str,
    except_session: Option<Uuid>,
) -> Result<u64, AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = $2
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND ($3::uuid IS NULL OR session_id <> $3)
        "#,
        user_id,
        reason,
        except_session
    )
    .execute(executor)
    .await?;

    Ok(result.rows_affected())
}

/// Active (unrevoked, unexpired) sessions of a user, most recently active first
pub async fn list_sessions(pool: &PgPool, user_id: Uuid) -> Result<Vec<ActiveSession>, AppError> {
    let sessions = sqlx::query_as!(
        ActiveSession,
        r#"
        SELECT
            session_id,
            session_started_at AS started_at,
            created_at AS last_active_at,
            expires_at,
            user_agent,
            ip
        FROM refresh_tokens
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(sessions)
}

/// Delete tokens that expired or were revoked more than 30 days ago
pub async fn purge_stale_tokens(pool: &PgPool) -> Result<u64, AppError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM refresh_tokens
        WHERE expires_at < NOW() - INTERVAL '30 days'
           OR revoked_at < NOW() - INTERVAL '30 days'
        "#
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
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

    tracing::info!(
        "[OTP VERIFY] Attempting verification for email: '{}'",
        email
    );

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
                    "Liian monta virheellistä yritystä. Kirjautuminen on lukittu 5 minuutiksi."
                        .to_string(),
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
