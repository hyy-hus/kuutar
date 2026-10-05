use sqlx::PgPool;
use uuid::Uuid;

use super::models::{CreateResource, Resource, UpdateResource};
use crate::{errors::AppError, utils::rich_text};

/// Fetches resources. If `is_admin` is false, only public resources (`is_public = TRUE`) are returned.
pub async fn list_all(pool: &PgPool, is_admin: bool) -> Result<Vec<Resource>, AppError> {
    let resources = sqlx::query_as!(
        Resource,
        r#"
        SELECT id, collection_id, name, description, allow_recurring, blocks_only, reservable_until, is_public, created_at, updated_at, deleted_at
        FROM resources
        WHERE deleted_at IS NULL
          AND ($1 = TRUE OR is_public = TRUE)
        ORDER BY name ASC
        "#,
        is_admin
    )
    .fetch_all(pool)
    .await?;

    Ok(resources)
}

/// Fetches an active resource by ID. Fails with NotFound if non-admin requests a non-public resource.
pub async fn find_by_id(pool: &PgPool, id: Uuid, is_admin: bool) -> Result<Resource, AppError> {
    sqlx::query_as!(
        Resource,
        r#"
        SELECT id, collection_id, name, description, allow_recurring, blocks_only, reservable_until, is_public, created_at, updated_at, deleted_at
        FROM resources
        WHERE id = $1 
          AND deleted_at IS NULL
          AND ($2 = TRUE OR is_public = TRUE)
        "#,
        id,
        is_admin
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn create(pool: &PgPool, dto: CreateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let resource = sqlx::query_as!(
        Resource,
        r#"
        INSERT INTO resources (collection_id, name, description, allow_recurring, reservable_until, is_public, blocks_only)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, collection_id, name, description, allow_recurring, blocks_only, reservable_until, is_public, created_at, updated_at, deleted_at
        "#,
        dto.collection_id,
        dto.name,
        dto.description.map(rich_text::to_json),
        dto.allow_recurring,
        dto.reservable_until,
        dto.is_public,
        dto.blocks_only
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(contract_ids) = dto.contract_ids {
        for contract_id in contract_ids {
            sqlx::query!(
                "INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1, $2)",
                resource.id,
                contract_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(resource)
}

pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let resource = sqlx::query_as!(
        Resource,
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
            updated_at = NOW()
        WHERE id = $7 AND deleted_at IS NULL
        RETURNING id, collection_id, name, description, allow_recurring, blocks_only, reservable_until, is_public, created_at, updated_at, deleted_at
        "#,
        dto.name,
        dto.allow_recurring,
        dto.reservable_until,
        dto.is_public,
        dto.description.map(rich_text::to_json),
        dto.blocks_only,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

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

    Ok(resource)
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
