use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    CreateReservableBlockOccurrencePayload, CreateReservableBlockPayload, ReservableBlock,
    ReservableBlockOccurrence, ReservableBlockWithOccurrences, UpdateReservableBlockPayload,
};
use crate::errors::AppError;

/// Blocks can only be defined for resources that have `blocks_only` enabled.
pub async fn ensure_blocks_only_resources(
    pool: &PgPool,
    resource_ids: &[Uuid],
) -> Result<(), AppError> {
    for resource_id in resource_ids {
        let blocks_only = sqlx::query_scalar!(
            r#"SELECT blocks_only FROM resources WHERE id = $1 AND deleted_at IS NULL"#,
            resource_id
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Resurssia ei löytynyt.".to_string()))?;

        if !blocks_only {
            return Err(AppError::BadRequest(
                "Varausjaksoja voi luoda vain resursseille, joilla on käytössä vain varausjaksot."
                    .to_string(),
            ));
        }
    }
    Ok(())
}

/// Blocks with at least one occurrence overlapping the window. Only the occurrences
/// inside the window are returned.
pub async fn list_filtered(
    pool: &PgPool,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    resource_id: Option<Uuid>,
) -> Result<Vec<ReservableBlockWithOccurrences>, AppError> {
    let occurrences =
        fetch_occurrences(pool, None, Some((start_date, end_date)), resource_id).await?;

    if occurrences.is_empty() {
        return Ok(Vec::new());
    }

    let mut by_block: HashMap<Uuid, Vec<ReservableBlockOccurrence>> = HashMap::new();
    for occ in occurrences {
        by_block.entry(occ.block_id).or_default().push(occ);
    }
    let block_ids: Vec<Uuid> = by_block.keys().copied().collect();

    let blocks = sqlx::query_as!(
        ReservableBlock,
        r#"
        SELECT id, title, description, rrule, created_at, updated_at
        FROM reservable_blocks
        WHERE id = ANY($1) AND deleted_at IS NULL
        ORDER BY created_at DESC
        "#,
        &block_ids
    )
    .fetch_all(pool)
    .await?;

    Ok(blocks
        .into_iter()
        .map(|block| {
            let occurrences = by_block.remove(&block.id).unwrap_or_default();
            ReservableBlockWithOccurrences { block, occurrences }
        })
        .collect())
}

pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<ReservableBlockWithOccurrences, AppError> {
    let block = sqlx::query_as!(
        ReservableBlock,
        r#"
        SELECT id, title, description, rrule, created_at, updated_at
        FROM reservable_blocks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let occurrences = fetch_occurrences(pool, Some(id), None, None).await?;

    Ok(ReservableBlockWithOccurrences { block, occurrences })
}

async fn fetch_occurrences(
    pool: &PgPool,
    block_id: Option<Uuid>,
    window: Option<(DateTime<Utc>, DateTime<Utc>)>,
    resource_id: Option<Uuid>,
) -> Result<Vec<ReservableBlockOccurrence>, AppError> {
    let (window_start, window_end) = match window {
        Some((start, end)) => (Some(start), Some(end)),
        None => (None, None),
    };

    let occurrences = sqlx::query_as!(
        ReservableBlockOccurrence,
        r#"
        SELECT
            bo.id,
            bo.block_id,
            bo.resource_id,
            bo.start_time,
            bo.end_time,
            bo.created_at,
            EXISTS (
                SELECT 1
                FROM occurrences o
                JOIN reservations r ON r.id = o.reservation_id
                WHERE o.resource_id = bo.resource_id
                  AND r.deleted_at IS NULL
                  AND r.status IN ('confirmed', 'pending')
                  AND o.start_time < bo.end_time
                  AND o.end_time > bo.start_time
            ) AS "reserved!"
        FROM reservable_block_occurrences bo
        JOIN reservable_blocks b ON b.id = bo.block_id
        WHERE b.deleted_at IS NULL
          AND ($1::uuid IS NULL OR bo.block_id = $1)
          AND ($2::timestamptz IS NULL OR bo.end_time > $2)
          AND ($3::timestamptz IS NULL OR bo.start_time < $3)
          AND ($4::uuid IS NULL OR bo.resource_id = $4)
        ORDER BY bo.start_time ASC
        "#,
        block_id,
        window_start,
        window_end,
        resource_id
    )
    .fetch_all(pool)
    .await?;

    Ok(occurrences)
}

async fn insert_occurrences(
    tx: &mut sqlx::PgConnection,
    block_id: Uuid,
    occurrences: Vec<CreateReservableBlockOccurrencePayload>,
) -> Result<(), AppError> {
    for occ in occurrences {
        sqlx::query!(
            r#"
            INSERT INTO reservable_block_occurrences (block_id, resource_id, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            "#,
            block_id,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

pub async fn create(
    pool: &PgPool,
    dto: CreateReservableBlockPayload,
) -> Result<ReservableBlockWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    let block_id = sqlx::query_scalar!(
        r#"
        INSERT INTO reservable_blocks (title, description, rrule)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        dto.title,
        dto.description,
        dto.rrule
    )
    .fetch_one(&mut *tx)
    .await?;

    insert_occurrences(&mut tx, block_id, dto.occurrences).await?;

    tx.commit().await?;
    find_by_id(pool, block_id).await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    dto: UpdateReservableBlockPayload,
) -> Result<ReservableBlockWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE reservable_blocks
        SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            rrule = COALESCE($3, rrule),
            updated_at = NOW()
        WHERE id = $4 AND deleted_at IS NULL
        "#,
        dto.title,
        dto.description,
        dto.rrule,
        id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    if let Some(new_occurrences) = dto.occurrences {
        sqlx::query!(
            r#"DELETE FROM reservable_block_occurrences WHERE block_id = $1"#,
            id
        )
        .execute(&mut *tx)
        .await?;

        insert_occurrences(&mut tx, id, new_occurrences).await?;
    }

    tx.commit().await?;
    find_by_id(pool, id).await
}

pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE reservable_blocks
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}
