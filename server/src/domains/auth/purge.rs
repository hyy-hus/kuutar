use std::time::Duration;

use sqlx::PgPool;

use super::db;

/// Starts a background loop that deletes long-expired and long-revoked refresh tokens daily.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match db::purge_stale_tokens(&pool).await {
                Ok(0) => {}
                Ok(n) => tracing::info!("Purged {n} stale refresh tokens"),
                Err(err) => tracing::error!("Refresh token purge failed: {err}"),
            }
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
        }
    });
}
