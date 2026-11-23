//! Rate limits for the auth endpoints, counted in the `auth_attempts` table so they hold
//! across restarts and container instances.
//!
//! Per-IP limits are loose on purpose: a university or office network can put many users
//! behind one address. Per-email limits are what stop password guessing on an account.

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::errors::AppError;

/// At most `max` attempts per key within `window_secs`.
#[derive(Debug, Clone, Copy)]
pub struct Limit {
    pub action: &'static str,
    pub max: i64,
    pub window_secs: i64,
}

const MIN: i64 = 60;

/// Failed password logins per email
pub const LOGIN_EMAIL: Limit = Limit {
    action: "login_email",
    max: 10,
    window_secs: 15 * MIN,
};
/// Failed password logins per IP
pub const LOGIN_IP: Limit = Limit {
    action: "login_ip",
    max: 50,
    window_secs: 15 * MIN,
};
/// Email code requests per email
pub const OTP_REQUEST_EMAIL: Limit = Limit {
    action: "otp_request_email",
    max: 3,
    window_secs: 15 * MIN,
};
/// Email code requests per IP
pub const OTP_REQUEST_IP: Limit = Limit {
    action: "otp_request_ip",
    max: 20,
    window_secs: 15 * MIN,
};
/// Failed email code verifications per IP (per email is limited by `otp_fails`)
pub const OTP_VERIFY_IP: Limit = Limit {
    action: "otp_verify_ip",
    max: 50,
    window_secs: 15 * MIN,
};
/// Registrations per IP
pub const REGISTER_IP: Limit = Limit {
    action: "register_ip",
    max: 10,
    window_secs: 60 * MIN,
};
/// Token refreshes per IP; only guards load, since refresh tokens can't be guessed
pub const REFRESH_IP: Limit = Limit {
    action: "refresh_ip",
    max: 300,
    window_secs: 15 * MIN,
};

/// Normalizes an email for use as a key
pub fn email_key(email: &str) -> String {
    email.trim().to_lowercase()
}

/// Fails with 429 and `Retry-After` when `key` has used up `limit`. A missing key (no
/// client IP known) is never limited.
pub async fn check(pool: &PgPool, limit: Limit, key: Option<&str>) -> Result<(), AppError> {
    let Some(key) = key else { return Ok(()) };

    let row = sqlx::query!(
        r#"
        SELECT COUNT(*) AS "count!", MIN(attempted_at) AS oldest
        FROM auth_attempts
        WHERE action = $1 AND key = $2
          AND attempted_at > NOW() - make_interval(secs => $3)
        "#,
        limit.action,
        key,
        limit.window_secs as f64
    )
    .fetch_one(pool)
    .await?;

    if row.count < limit.max {
        return Ok(());
    }

    tracing::warn!(action = limit.action, "Rate limit reached");
    Err(AppError::TooManyRequests {
        message: "Liian monta yritystä. Yritä myöhemmin uudelleen.".to_string(),
        retry_after_secs: Some(retry_after(row.oldest, limit, Utc::now())),
    })
}

/// Seconds until the oldest attempt in the window falls out of it
fn retry_after(oldest: Option<DateTime<Utc>>, limit: Limit, now: DateTime<Utc>) -> u64 {
    let Some(oldest) = oldest else {
        return limit.window_secs as u64;
    };
    let frees_at = oldest + chrono::Duration::seconds(limit.window_secs);
    (frees_at - now).num_seconds().clamp(1, limit.window_secs) as u64
}

/// Counts one attempt for `key` towards `limit`
pub async fn record(pool: &PgPool, limit: Limit, key: Option<&str>) -> Result<(), AppError> {
    let Some(key) = key else { return Ok(()) };
    sqlx::query!(
        "INSERT INTO auth_attempts (action, key) VALUES ($1, $2)",
        limit.action,
        key
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Forgets the attempts of `key` towards `limit`, e.g. after a successful login
pub async fn clear(pool: &PgPool, limit: Limit, key: &str) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM auth_attempts WHERE action = $1 AND key = $2",
        limit.action,
        key
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Deletes counters older than a day (no limit has a longer window), and old OTP failures
pub async fn purge_old_attempts(pool: &PgPool) -> Result<u64, AppError> {
    let attempts =
        sqlx::query!("DELETE FROM auth_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'")
            .execute(pool)
            .await?
            .rows_affected();
    let otp_fails =
        sqlx::query!("DELETE FROM otp_fails WHERE attempted_at < NOW() - INTERVAL '1 day'")
            .execute(pool)
            .await?
            .rows_affected();
    Ok(attempts + otp_fails)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_after_counts_down_from_the_oldest_attempt() {
        let now = Utc::now();
        let oldest = now - chrono::Duration::seconds(5 * 60);
        assert_eq!(retry_after(Some(oldest), LOGIN_EMAIL, now), 10 * 60);
    }

    #[test]
    fn retry_after_is_at_least_one_second() {
        let now = Utc::now();
        let oldest = now - chrono::Duration::seconds(LOGIN_EMAIL.window_secs + 10);
        assert_eq!(retry_after(Some(oldest), LOGIN_EMAIL, now), 1);
        assert_eq!(retry_after(None, LOGIN_EMAIL, now), 15 * 60);
    }

    #[test]
    fn email_keys_are_normalized() {
        assert_eq!(email_key("  User@Example.TEST "), "user@example.test");
    }
}
