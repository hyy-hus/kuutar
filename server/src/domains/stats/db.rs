//! Database layer for the `stats` domain.
//!
//! Handles aggregated statistics queries for reservations, resources, and users.

use sqlx::PgPool;

use super::models::{SystemStats, TopResourceStat};
use crate::errors::AppError;

/// Fetches system statistics overview.
pub async fn get_system_stats(pool: &PgPool) -> Result<SystemStats, AppError> {
    let total_reservations = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) 
        FROM reservations 
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_reservations = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) 
        FROM reservations 
        WHERE status = 'pending' AND deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let confirmed_reservations = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) 
        FROM reservations 
        WHERE status = 'confirmed' AND deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let total_resources = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) 
        FROM resources 
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let total_users = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) 
        FROM users 
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let top_resources_rows = sqlx::query!(
        r#"
        SELECT 
            res.id as "resource_id!",
            res.name as "resource_name!",
            COUNT(occ.id) as "reservation_count!"
        FROM resources res
        LEFT JOIN occurrences occ ON occ.resource_id = res.id
        LEFT JOIN reservations r ON r.id = occ.reservation_id AND r.deleted_at IS NULL
        WHERE res.deleted_at IS NULL
        GROUP BY res.id, res.name
        ORDER BY "reservation_count!" DESC
        LIMIT 5
        "#
    )
    .fetch_all(pool)
    .await?;

    let top_resources = top_resources_rows
        .into_iter()
        .map(|row| TopResourceStat {
            resource_id: row.resource_id,
            resource_name: row.resource_name,
            reservation_count: row.reservation_count,
        })
        .collect();

    Ok(SystemStats {
        total_reservations,
        pending_reservations,
        confirmed_reservations,
        total_resources,
        total_users,
        top_resources,
    })
}
