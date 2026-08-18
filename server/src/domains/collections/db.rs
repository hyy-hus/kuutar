//! Database queries for the `collections` domain.

use sqlx::PgPool;
use uuid::Uuid;

use super::models::{Collection, CreateCollection, UpdateCollection};
use crate::errors::AppError;

/// Fetches all active collections.
pub async fn list_all(pool: &PgPool) -> Result<Vec<Collection>, AppError> {
    let collections = sqlx::query_as!(
        Collection,
        r#"
        SELECT id, name, created_at, updated_at, deleted_at
        FROM collections
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(collections)
}

/// Fetches an active collection by ID.
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Collection, AppError> {
    sqlx::query_as!(
        Collection,
        r#"
        SELECT id, name, created_at, updated_at, deleted_at
        FROM collections
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Inserts a new collection.
pub async fn create(pool: &PgPool, dto: CreateCollection) -> Result<Collection, AppError> {
    let collection = sqlx::query_as!(
        Collection,
        r#"
        INSERT INTO collections (name)
        VALUES ($1)
        RETURNING id, name, created_at, updated_at, deleted_at
        "#,
        dto.name
    )
    .fetch_one(pool)
    .await?;

    Ok(collection)
}

/// Performs a partial update on an active collection.
pub async fn update(
    pool: &PgPool,
    id: Uuid,
    dto: UpdateCollection,
) -> Result<Collection, AppError> {
    let collection = sqlx::query_as!(
        Collection,
        r#"
        UPDATE collections
        SET name = COALESCE($1, name)
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING id, name, created_at, updated_at, deleted_at
        "#,
        dto.name,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(collection)
}

/// Soft-deletes a collection by setting its `deleted_at` timestamp.
pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE collections
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
