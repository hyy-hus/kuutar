use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    CreateRestrictionPayload, Restriction, RestrictionOccurrence, RestrictionWithOccurrences,
    UpdateRestrictionPayload,
};
use crate::errors::AppError;

pub async fn list_filtered(
    pool: &PgPool,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    resource_id: Option<Uuid>,
) -> Result<Vec<RestrictionWithOccurrences>, AppError> {
    let restriction_ids = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT r.id
        FROM restrictions r
        JOIN restriction_occurrences ro ON ro.restriction_id = r.id
        WHERE r.deleted_at IS NULL
          AND ro.start_time < $2
          AND ro.end_time > $1
          AND ($3::uuid IS NULL OR ro.resource_id IS NULL OR ro.resource_id = $3)
        ORDER BY r.id
        "#,
        start_date,
        end_date,
        resource_id
    )
    .fetch_all(pool)
    .await?;

    if restriction_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut result = Vec::with_capacity(restriction_ids.len());
    for id in restriction_ids {
        if let Ok(res) = find_by_id(pool, id).await {
            result.push(res);
        }
    }

    Ok(result)
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<RestrictionWithOccurrences, AppError> {
    let base = sqlx::query!(
        r#"
        SELECT id, title, description, rrule, created_at, updated_at
        FROM restrictions
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let occurrences = sqlx::query_as!(
        RestrictionOccurrence,
        r#"
        SELECT id, restriction_id, resource_id, start_time, end_time, created_at
        FROM restriction_occurrences
        WHERE restriction_id = $1
        ORDER BY start_time ASC
        "#,
        id
    )
    .fetch_all(pool)
    .await?;

    let exempt_group_ids = sqlx::query_scalar!(
        r#"SELECT group_id FROM restriction_exemptions WHERE restriction_id = $1"#,
        id
    )
    .fetch_all(pool)
    .await?;

    let restriction = Restriction {
        id: base.id,
        title: base.title,
        description: base.description,
        rrule: base.rrule,
        exempt_group_ids,
        created_at: base.created_at,
        updated_at: base.updated_at,
    };

    Ok(RestrictionWithOccurrences {
        restriction,
        occurrences,
    })
}

pub async fn create(
    pool: &PgPool,
    dto: CreateRestrictionPayload,
) -> Result<RestrictionWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    let restriction_id = sqlx::query_scalar!(
        r#"
        INSERT INTO restrictions (title, description, rrule)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        dto.title,
        dto.description,
        dto.rrule
    )
    .fetch_one(&mut *tx)
    .await?;

    for occ in dto.occurrences {
        sqlx::query!(
            r#"
            INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            "#,
            restriction_id,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .execute(&mut *tx)
        .await?;
    }

    if let Some(group_ids) = dto.exempt_group_ids {
        for group_id in group_ids {
            sqlx::query!(
                r#"INSERT INTO restriction_exemptions (restriction_id, group_id) VALUES ($1, $2)"#,
                restriction_id,
                group_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    find_by_id(pool, restriction_id).await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    dto: UpdateRestrictionPayload,
) -> Result<RestrictionWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        r#"
        UPDATE restrictions
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

    if let Some(new_occurrences) = dto.occurrences {
        sqlx::query!(
            r#"DELETE FROM restriction_occurrences WHERE restriction_id = $1"#,
            id
        )
        .execute(&mut *tx)
        .await?;

        for occ in new_occurrences {
            sqlx::query!(
                r#"
                INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time)
                VALUES ($1, $2, $3, $4)
                "#,
                id,
                occ.resource_id,
                occ.start_time,
                occ.end_time
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(group_ids) = dto.exempt_group_ids {
        sqlx::query!(
            r#"DELETE FROM restriction_exemptions WHERE restriction_id = $1"#,
            id
        )
        .execute(&mut *tx)
        .await?;

        for group_id in group_ids {
            sqlx::query!(
                r#"INSERT INTO restriction_exemptions (restriction_id, group_id) VALUES ($1, $2)"#,
                id,
                group_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    find_by_id(pool, id).await
}

pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE restrictions
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
