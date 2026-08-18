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
        SELECT id, collection_id, name, created_at, updated_at, deleted_at
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
        SELECT id, collection_id, name, created_at, updated_at, deleted_at
        FROM resources
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Inserts a new resource into the database.
///
/// # Errors
///
/// Returns [`AppError::Conflict`] if a resource with the same name already exists
/// in the collection.
/// Returns [`AppError::Database`] if the referenced `collection_id` does not exist.
pub async fn create(pool: &PgPool, dto: CreateResource) -> Result<Resource, AppError> {
    let resource = sqlx::query_as!(
        Resource,
        r#"
        INSERT INTO resources (collection_id, name)
        VALUES ($1, $2)
        RETURNING id, collection_id, name, created_at, updated_at, deleted_at
        "#,
        dto.collection_id,
        dto.name
    )
    .fetch_one(pool)
    .await?;

    Ok(resource)
}

/// Performs a partial update on an active resource.
///
/// Fields in [`UpdateResource`] that are `None` remain unchanged in the database
/// via SQL `COALESCE`.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the resource does not exist or is soft-deleted.
/// Returns [`AppError::Conflict`] if the new name conflicts with an existing active resource in the collection.
pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateResource) -> Result<Resource, AppError> {
    let resource = sqlx::query_as!(
        Resource,
        r#"
        UPDATE resources
        SET name = COALESCE($1, name)
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING id, collection_id, name, created_at, updated_at, deleted_at
        "#,
        dto.name,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

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
