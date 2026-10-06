use sqlx::PgPool;
use uuid::Uuid;

use super::models::{CreateResource, Resource, UpdateResource};
use crate::{errors::AppError, utils::rich_text};

/// Fetches resources. If `is_admin` is false, only public resources (`is_public = TRUE`) are returned.
/// `group_id` is the requesting user's group, used to compute `can_reserve`.
pub async fn list_all(
    pool: &PgPool,
    is_admin: bool,
    group_id: Option<Uuid>,
) -> Result<Vec<Resource>, AppError> {
    let resources = sqlx::query_as!(
        Resource,
        r#"
        SELECT r.id, r.collection_id, r.name, r.description, r.allow_recurring, r.blocks_only, r.reservable_until, r.is_public,
               r.reservation_restricted, r.auto_confirm, r.default_duration_minutes, r.min_duration_minutes, r.max_duration_minutes, r.color,
               CASE WHEN $1 THEN r.outlook_email END AS outlook_email,
               COALESCE(ARRAY(SELECT rg.group_id FROM resource_groups rg WHERE rg.resource_id = r.id ORDER BY rg.group_id), '{}') AS "reservable_group_ids!",
               COALESCE(ARRAY(SELECT ag.group_id FROM resource_auto_confirm_groups ag WHERE ag.resource_id = r.id ORDER BY ag.group_id), '{}') AS "auto_confirm_group_ids!",
               ($1 OR NOT r.reservation_restricted OR EXISTS (
                   SELECT 1 FROM resource_groups rg WHERE rg.resource_id = r.id AND rg.group_id = $2
               )) AS "can_reserve!",
               r.created_at, r.updated_at, r.deleted_at
        FROM resources r
        WHERE r.deleted_at IS NULL
          AND ($1 = TRUE OR r.is_public = TRUE)
        ORDER BY r.name ASC
        "#,
        is_admin,
        group_id
    )
    .fetch_all(pool)
    .await?;

    Ok(resources)
}

/// Fetches an active resource by ID. Fails with NotFound if non-admin requests a non-public resource.
pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
    is_admin: bool,
    group_id: Option<Uuid>,
) -> Result<Resource, AppError> {
    sqlx::query_as!(
        Resource,
        r#"
        SELECT r.id, r.collection_id, r.name, r.description, r.allow_recurring, r.blocks_only, r.reservable_until, r.is_public,
               r.reservation_restricted, r.auto_confirm, r.default_duration_minutes, r.min_duration_minutes, r.max_duration_minutes, r.color,
               CASE WHEN $1 THEN r.outlook_email END AS outlook_email,
               COALESCE(ARRAY(SELECT rg.group_id FROM resource_groups rg WHERE rg.resource_id = r.id ORDER BY rg.group_id), '{}') AS "reservable_group_ids!",
               COALESCE(ARRAY(SELECT ag.group_id FROM resource_auto_confirm_groups ag WHERE ag.resource_id = r.id ORDER BY ag.group_id), '{}') AS "auto_confirm_group_ids!",
               ($1 OR NOT r.reservation_restricted OR EXISTS (
                   SELECT 1 FROM resource_groups rg WHERE rg.resource_id = r.id AND rg.group_id = $2
               )) AS "can_reserve!",
               r.created_at, r.updated_at, r.deleted_at
        FROM resources r
        WHERE r.id = $3
          AND r.deleted_at IS NULL
          AND ($1 = TRUE OR r.is_public = TRUE)
        "#,
        is_admin,
        group_id,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

async fn replace_auto_confirm_groups(
    tx: &mut sqlx::PgConnection,
    resource_id: Uuid,
    group_ids: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM resource_auto_confirm_groups WHERE resource_id = $1",
        resource_id
    )
    .execute(&mut *tx)
    .await?;

    for group_id in group_ids {
        sqlx::query!(
            "INSERT INTO resource_auto_confirm_groups (resource_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            resource_id,
            group_id
        )
        .execute(&mut *tx)
        .await?;
    }

    Ok(())
}

async fn replace_groups(
    tx: &mut sqlx::PgConnection,
    resource_id: Uuid,
    group_ids: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM resource_groups WHERE resource_id = $1",
        resource_id
    )
    .execute(&mut *tx)
    .await?;

    for group_id in group_ids {
        sqlx::query!(
            "INSERT INTO resource_groups (resource_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            resource_id,
            group_id
        )
        .execute(&mut *tx)
        .await?;
    }

    Ok(())
}

pub async fn create(pool: &PgPool, dto: CreateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO resources (collection_id, name, description, allow_recurring, reservable_until, is_public, blocks_only, reservation_restricted, auto_confirm, default_duration_minutes, min_duration_minutes, max_duration_minutes, color, outlook_email)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULLIF(LOWER(TRIM($14)), ''))
        RETURNING id
        "#,
        dto.collection_id,
        dto.name,
        dto.description.map(rich_text::to_json),
        dto.allow_recurring,
        dto.reservable_until,
        dto.is_public,
        dto.blocks_only,
        dto.reservation_restricted,
        dto.auto_confirm,
        dto.default_duration_minutes,
        dto.min_duration_minutes,
        dto.max_duration_minutes,
        dto.color.filter(|c| !c.is_empty()),
        dto.outlook_email
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(group_ids) = &dto.group_ids {
        replace_groups(&mut tx, id, group_ids).await?;
    }

    if let Some(group_ids) = &dto.auto_confirm_group_ids {
        replace_auto_confirm_groups(&mut tx, id, group_ids).await?;
    }

    if let Some(contract_ids) = dto.contract_ids {
        for contract_id in contract_ids {
            sqlx::query!(
                "INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1, $2)",
                id,
                contract_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    find_by_id(pool, id, true, None).await
}

pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let updated = sqlx::query!(
        r#"
        UPDATE resources
        SET 
            name = COALESCE($1, name),
            allow_recurring = COALESCE($2, allow_recurring),
            reservable_until = CASE 
                WHEN $3::timestamptz IS NOT NULL THEN $3
                ELSE reservable_until 
            END,
            is_public = COALESCE($4, is_public),
            description = COALESCE($5, description),
            blocks_only = COALESCE($6, blocks_only),
            reservation_restricted = COALESCE($7, reservation_restricted),
            auto_confirm = COALESCE($8, auto_confirm),
            -- 0 clears a duration
            default_duration_minutes = CASE WHEN $9::int IS NULL THEN default_duration_minutes ELSE NULLIF($9, 0) END,
            min_duration_minutes = CASE WHEN $10::int IS NULL THEN min_duration_minutes ELSE NULLIF($10, 0) END,
            max_duration_minutes = CASE WHEN $11::int IS NULL THEN max_duration_minutes ELSE NULLIF($11, 0) END,
            -- An empty string clears the color
            color = CASE WHEN $12::text IS NULL THEN color ELSE NULLIF($12, '') END,
            -- An empty string clears the mailbox
            outlook_email = CASE WHEN $13::text IS NULL THEN outlook_email ELSE NULLIF(LOWER(TRIM($13)), '') END,
            updated_at = NOW()
        WHERE id = $14 AND deleted_at IS NULL
        "#,
        dto.name,
        dto.allow_recurring,
        dto.reservable_until,
        dto.is_public,
        dto.description.map(rich_text::to_json),
        dto.blocks_only,
        dto.reservation_restricted,
        dto.auto_confirm,
        dto.default_duration_minutes,
        dto.min_duration_minutes,
        dto.max_duration_minutes,
        dto.color,
        dto.outlook_email,
        id
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if updated == 0 {
        return Err(AppError::NotFound);
    }

    if let Some(group_ids) = &dto.group_ids {
        replace_groups(&mut tx, id, group_ids).await?;
    }

    if let Some(group_ids) = &dto.auto_confirm_group_ids {
        replace_auto_confirm_groups(&mut tx, id, group_ids).await?;
    }

    if let Some(contract_ids) = dto.contract_ids {
        sqlx::query!("DELETE FROM resource_contracts WHERE resource_id = $1", id)
            .execute(&mut *tx)
            .await?;

        for contract_id in contract_ids {
            sqlx::query!(
                "INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1, $2)",
                id,
                contract_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    find_by_id(pool, id, true, None).await
}

pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE resources
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
