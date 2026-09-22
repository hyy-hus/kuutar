//! Database layer for the `resources` domain.
//!
//! Handles all SQL queries for resources. All read and update operations
//! automatically exclude soft-deleted records (`deleted_at IS NULL`).

use sqlx::PgPool;
use uuid::Uuid;

use super::models::{CreateResource, Resource, UpdateResource};
use crate::errors::AppError;

/// Fetches all active resources.
pub async fn list_all(pool: &PgPool) -> Result<Vec<Resource>, AppError> {
    let resources = sqlx::query_as!(
        Resource,
        r#"
        SELECT id, collection_id, name, allow_recurring, created_at, updated_at, deleted_at
        FROM resources
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(resources)
}

/// Fetches an active resource by its unique ID.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the resource does not exist or has been soft-deleted.
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Resource, AppError> {
    sqlx::query_as!(
        Resource,
        r#"
        SELECT id, collection_id, name, allow_recurring, created_at, updated_at, deleted_at
        FROM resources
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Inserts a new resource into the database and binds its contract associations.
///
/// # Errors
///
/// Returns [`AppError::Conflict`] if a resource with the same name already exists
/// in the collection.
/// Returns [`AppError::Database`] if the referenced `collection_id` does not exist.
pub async fn create(pool: &PgPool, dto: CreateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let resource = sqlx::query_as!(
        Resource,
        r#"
        INSERT INTO resources (collection_id, name, allow_recurring)
        VALUES ($1, $2, $3)
        RETURNING id, collection_id, name, allow_recurring, created_at, updated_at, deleted_at
        "#,
        dto.collection_id,
        dto.name,
        dto.allow_recurring
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

/// Performs a partial update on an active resource and synchronizes contract bindings.
///
/// Fields in [`UpdateResource`] that are `None` remain unchanged in the database.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the resource does not exist or is soft-deleted.
/// Returns [`AppError::Conflict`] if the new name conflicts with an existing active resource in the collection.
pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateResource) -> Result<Resource, AppError> {
    let mut tx = pool.begin().await?;

    let resource = sqlx::query_as!(
        Resource,
        r#"
        UPDATE resources
        SET 
            name = COALESCE($1, name),
            allow_recurring = COALESCE($2, allow_recurring),
            updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, collection_id, name, allow_recurring, created_at, updated_at, deleted_at
        "#,
        dto.name,
        dto.allow_recurring,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(contract_ids) = dto.contract_ids {
        // Clear old contract bindings for this resource
        sqlx::query!("DELETE FROM resource_contracts WHERE resource_id = $1", id)
            .execute(&mut *tx)
            .await?;

        // Re-insert current selection
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

/// Soft-deletes a resource by setting its `deleted_at` timestamp.
///
/// Does not physically remove the row from PostgreSQL.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the resource does not exist or was already soft-deleted.
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
