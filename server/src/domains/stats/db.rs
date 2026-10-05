//! Database layer for the `stats` domain.
//!
//! Handles aggregated statistics queries. Usage figures count occurrences of
//! non-cancelled, non-deleted reservations that have already started; calendar
//! bucketing happens in Europe/Helsinki so months and hours match what users see.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    AdminStats, GroupStat, HeatCell, MonthlyStat, MyStats, NewUsersMonth, PublicStats,
    StatusCounts, TopResourceStat, UnusedResource, UpcomingOccurrence, UsageTotals, UserStat,
};
use crate::errors::AppError;

/// Which occurrences a usage query covers
#[derive(Clone, Copy)]
struct Scope {
    from: Option<DateTime<Utc>>,
    /// Only occurrences on public resources
    public_only: bool,
    /// Only reservations owned by this user
    user_id: Option<Uuid>,
}

async fn usage_totals(pool: &PgPool, scope: Scope) -> Result<UsageTotals, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*) AS "occurrences!",
            COALESCE(SUM(EXTRACT(EPOCH FROM occ.end_time - occ.start_time)) / 3600, 0)::float8 AS "hours!",
            COUNT(DISTINCT occ.resource_id) AS "resources_used!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN resources res ON res.id = occ.resource_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled' AND res.deleted_at IS NULL
          AND occ.start_time <= now()
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
          AND (NOT $2 OR res.is_public)
          AND ($3::uuid IS NULL OR r.user_id = $3)
        "#,
        scope.from,
        scope.public_only,
        scope.user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(UsageTotals {
        occurrences: row.occurrences,
        hours: row.hours,
        resources_used: row.resources_used,
    })
}

/// One row per month from the start of the range (or the first occurrence) to now
async fn monthly(pool: &PgPool, scope: Scope) -> Result<Vec<MonthlyStat>, AppError> {
    let rows = sqlx::query!(
        r#"
        WITH bounds AS (
            SELECT
                date_trunc('month', COALESCE($1::timestamptz, (SELECT MIN(start_time) FROM occurrences), now()) AT TIME ZONE 'Europe/Helsinki') AS first,
                date_trunc('month', now() AT TIME ZONE 'Europe/Helsinki') AS last
        ),
        months AS (
            SELECT generate_series(first, last, interval '1 month') AS m FROM bounds
        ),
        usage AS (
            SELECT
                date_trunc('month', occ.start_time AT TIME ZONE 'Europe/Helsinki') AS m,
                COUNT(*) AS c,
                SUM(EXTRACT(EPOCH FROM occ.end_time - occ.start_time)) / 3600 AS h
            FROM occurrences occ
            JOIN reservations r ON r.id = occ.reservation_id
            JOIN resources res ON res.id = occ.resource_id
            WHERE r.deleted_at IS NULL AND r.status <> 'cancelled' AND res.deleted_at IS NULL
              AND occ.start_time <= now()
              AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
              AND (NOT $2 OR res.is_public)
              AND ($3::uuid IS NULL OR r.user_id = $3)
            GROUP BY 1
        )
        SELECT
            to_char(months.m, 'YYYY-MM') AS "month!",
            COALESCE(usage.c, 0) AS "count!",
            COALESCE(usage.h, 0)::float8 AS "hours!"
        FROM months
        LEFT JOIN usage ON usage.m = months.m
        ORDER BY months.m
        "#,
        scope.from,
        scope.public_only,
        scope.user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| MonthlyStat {
            month: r.month,
            count: r.count,
            hours: r.hours,
        })
        .collect())
}

async fn top_resources(
    pool: &PgPool,
    scope: Scope,
    limit: i64,
) -> Result<Vec<TopResourceStat>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT
            res.id AS "resource_id!",
            res.name AS "resource_name!",
            res.color,
            COUNT(*) AS "count!",
            (SUM(EXTRACT(EPOCH FROM occ.end_time - occ.start_time)) / 3600)::float8 AS "hours!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN resources res ON res.id = occ.resource_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled' AND res.deleted_at IS NULL
          AND occ.start_time <= now()
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
          AND (NOT $2 OR res.is_public)
          AND ($3::uuid IS NULL OR r.user_id = $3)
        GROUP BY res.id, res.name, res.color
        ORDER BY 4 DESC, res.name
        LIMIT $4
        "#,
        scope.from,
        scope.public_only,
        scope.user_id,
        limit
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| TopResourceStat {
            resource_id: r.resource_id,
            resource_name: r.resource_name,
            color: r.color,
            count: r.count,
            hours: r.hours,
        })
        .collect())
}

async fn status_counts(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
    user_id: Option<Uuid>,
) -> Result<StatusCounts, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending') AS "pending!",
            COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed!",
            COUNT(*) FILTER (WHERE status = 'cancelled') AS "cancelled!"
        FROM reservations
        WHERE deleted_at IS NULL
          AND ($1::timestamptz IS NULL OR created_at >= $1)
          AND ($2::uuid IS NULL OR user_id = $2)
        "#,
        from,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(StatusCounts {
        pending: row.pending,
        confirmed: row.confirmed,
        cancelled: row.cancelled,
    })
}

/// Usage of public resources; safe to show to anyone
pub async fn public_stats(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
) -> Result<PublicStats, AppError> {
    let scope = Scope {
        from,
        public_only: true,
        user_id: None,
    };

    let totals = usage_totals(pool, scope).await?;
    let monthly = monthly(pool, scope).await?;
    let top_resources = top_resources(pool, scope, 8).await?;

    let public_resources = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM resources WHERE deleted_at IS NULL AND is_public"#
    )
    .fetch_one(pool)
    .await?;

    let weekday_hour = sqlx::query!(
        r#"
        SELECT
            (EXTRACT(ISODOW FROM occ.start_time AT TIME ZONE 'Europe/Helsinki')::int4 - 1) AS "weekday!",
            EXTRACT(HOUR FROM occ.start_time AT TIME ZONE 'Europe/Helsinki')::int4 AS "hour!",
            COUNT(*) AS "count!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN resources res ON res.id = occ.resource_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled'
          AND res.deleted_at IS NULL AND res.is_public
          AND occ.start_time <= now()
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
        GROUP BY 1, 2
        ORDER BY 1, 2
        "#,
        from
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| HeatCell {
        weekday: r.weekday,
        hour: r.hour,
        count: r.count,
    })
    .collect();

    Ok(PublicStats {
        totals,
        public_resources,
        monthly,
        weekday_hour,
        top_resources,
    })
}

/// The given user's own reservations, including on private resources
pub async fn my_stats(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
    user_id: Uuid,
) -> Result<MyStats, AppError> {
    let scope = Scope {
        from,
        public_only: false,
        user_id: Some(user_id),
    };

    let upcoming = sqlx::query!(
        r#"
        SELECT
            r.id AS "reservation_id!",
            r.title AS "title!",
            res.name AS "resource_name!",
            occ.start_time AS "start_time!",
            occ.end_time AS "end_time!",
            r.status::text AS "status!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN resources res ON res.id = occ.resource_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled' AND res.deleted_at IS NULL
          AND r.user_id = $1 AND occ.start_time > now()
        ORDER BY occ.start_time
        LIMIT 5
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| UpcomingOccurrence {
        reservation_id: r.reservation_id,
        title: r.title,
        resource_name: r.resource_name,
        start_time: r.start_time,
        end_time: r.end_time,
        status: r.status,
    })
    .collect();

    Ok(MyStats {
        totals: usage_totals(pool, scope).await?,
        statuses: status_counts(pool, from, Some(user_id)).await?,
        monthly: monthly(pool, scope).await?,
        favourite_resources: top_resources(pool, scope, 5).await?,
        upcoming,
    })
}

/// System-wide figures including private resources
pub async fn admin_stats(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
) -> Result<AdminStats, AppError> {
    let scope = Scope {
        from,
        public_only: false,
        user_id: None,
    };

    let counts = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS "users!",
            (SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL) AS "resources!",
            (SELECT COUNT(*) FROM groups WHERE deleted_at IS NULL) AS "groups!",
            (SELECT COUNT(*) FROM reservations WHERE deleted_at IS NULL AND status = 'pending') AS "pending_now!",
            (SELECT (EXTRACT(EPOCH FROM now() - MIN(created_at)) / 3600)::float8
               FROM reservations WHERE deleted_at IS NULL AND status = 'pending') AS oldest_pending_hours
        "#
    )
    .fetch_one(pool)
    .await?;

    let avg_lead_time_days = sqlx::query_scalar!(
        r#"
        SELECT (AVG(EXTRACT(EPOCH FROM occ.start_time - r.created_at)) / 86400)::float8
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled'
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
          AND occ.start_time <= now()
        "#,
        from
    )
    .fetch_one(pool)
    .await?;

    let unused_resources = sqlx::query!(
        r#"
        SELECT res.id AS "resource_id!", res.name AS "resource_name!"
        FROM resources res
        WHERE res.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM occurrences occ
            JOIN reservations r ON r.id = occ.reservation_id
            WHERE occ.resource_id = res.id
              AND r.deleted_at IS NULL AND r.status <> 'cancelled'
              AND occ.start_time <= now()
              AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
          )
        ORDER BY res.name
        "#,
        from
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| UnusedResource {
        resource_id: r.resource_id,
        resource_name: r.resource_name,
    })
    .collect();

    let groups = sqlx::query!(
        r#"
        SELECT
            g.id AS "group_id!",
            g.name AS "group_name!",
            COUNT(*) AS "count!",
            (SUM(EXTRACT(EPOCH FROM occ.end_time - occ.start_time)) / 3600)::float8 AS "hours!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = u.group_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled'
          AND occ.start_time <= now()
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
        GROUP BY g.id, g.name
        ORDER BY 3 DESC, g.name
        "#,
        from
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| GroupStat {
        group_id: r.group_id,
        group_name: r.group_name,
        count: r.count,
        hours: r.hours,
    })
    .collect();

    let top_users = sqlx::query!(
        r#"
        SELECT
            u.id AS "user_id!",
            u.email AS "email!",
            COUNT(*) AS "count!",
            (SUM(EXTRACT(EPOCH FROM occ.end_time - occ.start_time)) / 3600)::float8 AS "hours!"
        FROM occurrences occ
        JOIN reservations r ON r.id = occ.reservation_id
        JOIN users u ON u.id = r.user_id
        WHERE r.deleted_at IS NULL AND r.status <> 'cancelled'
          AND occ.start_time <= now()
          AND ($1::timestamptz IS NULL OR occ.start_time >= $1)
        GROUP BY u.id, u.email
        ORDER BY 3 DESC, u.email
        LIMIT 5
        "#,
        from
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| UserStat {
        user_id: r.user_id,
        email: r.email,
        count: r.count,
        hours: r.hours,
    })
    .collect();

    let new_users = sqlx::query!(
        r#"
        SELECT
            to_char(date_trunc('month', created_at AT TIME ZONE 'Europe/Helsinki'), 'YYYY-MM') AS "month!",
            COUNT(*) AS "count!"
        FROM users
        WHERE deleted_at IS NULL AND ($1::timestamptz IS NULL OR created_at >= $1)
        GROUP BY 1
        ORDER BY 1
        "#,
        from
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| NewUsersMonth {
        month: r.month,
        count: r.count,
    })
    .collect();

    Ok(AdminStats {
        total_users: counts.users,
        total_resources: counts.resources,
        total_groups: counts.groups,
        statuses: status_counts(pool, from, None).await?,
        pending_now: counts.pending_now,
        oldest_pending_hours: counts.oldest_pending_hours,
        avg_lead_time_days,
        totals: usage_totals(pool, scope).await?,
        monthly: monthly(pool, scope).await?,
        top_resources: top_resources(pool, scope, 8).await?,
        unused_resources,
        groups,
        top_users,
        new_users,
    })
}
