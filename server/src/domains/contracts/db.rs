//! Database layer for the `contracts` domain.

use sqlx::PgPool;
use uuid::Uuid;

use super::models::{Contract, CreateContract, UpdateContract};
use crate::errors::AppError;

/// Fetches all active contracts.
pub async fn list_all(pool: &PgPool) -> Result<Vec<Contract>, AppError> {
    let contracts = sqlx::query_as!(
        Contract,
        r#"
        SELECT id, name, body, created_at, updated_at, deleted_at
        FROM contracts
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(contracts)
}

/// Fetches an active contract by its unique ID.
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Contract, AppError> {
    sqlx::query_as!(
        Contract,
        r#"
        SELECT id, name, body, created_at, updated_at, deleted_at
        FROM contracts
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Inserts a new contract template.
pub async fn create(pool: &PgPool, dto: CreateContract) -> Result<Contract, AppError> {
    let contract = sqlx::query_as!(
        Contract,
        r#"
        INSERT INTO contracts (name, body)
        VALUES ($1, $2)
        RETURNING id, name, body, created_at, updated_at, deleted_at
        "#,
        dto.name,
        dto.body
    )
    .fetch_one(pool)
    .await?;

    Ok(contract)
}

/// Performs a partial update on an active contract.
pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateContract) -> Result<Contract, AppError> {
    let contract = sqlx::query_as!(
        Contract,
        r#"
        UPDATE contracts
        SET name = COALESCE($1, name),
            body = COALESCE($2, body)
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, name, body, created_at, updated_at, deleted_at
        "#,
        dto.name,
        dto.body,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(contract)
}

/// Soft-deletes a contract.
pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE contracts
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
