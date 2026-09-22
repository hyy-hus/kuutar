use sqlx::PgPool;
use uuid::Uuid;

use super::models::{Contract, CreateContract, UpdateContract};
use crate::errors::AppError;

/// Fetches all active contracts, optionally filtering by resource_id or active status.
pub async fn list_all(
    pool: &PgPool,
    resource_id: Option<Uuid>,
    only_active: bool,
) -> Result<Vec<Contract>, AppError> {
    let contracts = sqlx::query_as!(
        Contract,
        r#"
        SELECT DISTINCT
            c.id, c.title, c.s3_key, c.file_name, c.is_global, c.is_active,
            c.created_at, c.updated_at, c.deleted_at
        FROM contracts c
        LEFT JOIN resource_contracts rc ON c.id = rc.contract_id
        WHERE c.deleted_at IS NULL
          AND ($1::uuid IS NULL OR c.is_global = true OR rc.resource_id = $1)
          AND ($2 = false OR c.is_active = true)
        ORDER BY c.created_at DESC
        "#,
        resource_id,
        only_active
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
        SELECT 
            id, title, s3_key, file_name, is_global, is_active, 
            created_at, updated_at, deleted_at
        FROM contracts
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Fetches all contracts linked to a specific resource (including globals).
pub async fn list_for_resource(
    pool: &PgPool,
    resource_id: Uuid,
) -> Result<Vec<Contract>, AppError> {
    let contracts = sqlx::query_as!(
        Contract,
        r#"
        SELECT DISTINCT
            c.id, c.title, c.s3_key, c.file_name, c.is_global, c.is_active,
            c.created_at, c.updated_at, c.deleted_at
        FROM contracts c
        LEFT JOIN resource_contracts rc ON c.id = rc.contract_id
        WHERE c.deleted_at IS NULL
          AND c.is_active = true
          AND (c.is_global = true OR rc.resource_id = $1)
        ORDER BY c.created_at DESC
        "#,
        resource_id
    )
    .fetch_all(pool)
    .await?;

    Ok(contracts)
}

/// Inserts a new contract document and optionally links it to resources.
pub async fn create(pool: &PgPool, dto: CreateContract) -> Result<Contract, AppError> {
    let mut tx = pool.begin().await?;

    let title_json = serde_json::to_value(&dto.title)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    let s3_key_json = serde_json::to_value(&dto.s3_key)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    let file_name_json = serde_json::to_value(&dto.file_name)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let contract = sqlx::query_as!(
        Contract,
        r#"
        INSERT INTO contracts (title, s3_key, file_name, is_global, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, s3_key, file_name, is_global, is_active, created_at, updated_at, deleted_at
        "#,
        title_json,
        s3_key_json,
        file_name_json,
        dto.is_global,
        dto.is_active
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(resource_ids) = dto.resource_ids {
        for res_id in resource_ids {
            sqlx::query!(
                r#"
                INSERT INTO resource_contracts (resource_id, contract_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
                res_id,
                contract.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(contract)
}

/// Performs a partial update on an active contract document.
pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateContract) -> Result<Contract, AppError> {
    let mut tx = pool.begin().await?;

    let title_json = match dto.title {
        Some(val) => Some(
            serde_json::to_value(&val).map_err(|e| AppError::InternalServerError(e.to_string()))?,
        ),
        None => None,
    };
    let s3_key_json = match dto.s3_key {
        Some(val) => Some(
            serde_json::to_value(&val).map_err(|e| AppError::InternalServerError(e.to_string()))?,
        ),
        None => None,
    };
    let file_name_json = match dto.file_name {
        Some(val) => Some(
            serde_json::to_value(&val).map_err(|e| AppError::InternalServerError(e.to_string()))?,
        ),
        None => None,
    };

    let contract = sqlx::query_as!(
        Contract,
        r#"
        UPDATE contracts
        SET title = COALESCE($1, title),
            s3_key = COALESCE($2, s3_key),
            file_name = COALESCE($3, file_name),
            is_global = COALESCE($4, is_global),
            is_active = COALESCE($5, is_active),
            updated_at = NOW()
        WHERE id = $6 AND deleted_at IS NULL
        RETURNING id, title, s3_key, file_name, is_global, is_active, created_at, updated_at, deleted_at
        "#,
        title_json,
        s3_key_json,
        file_name_json,
        dto.is_global,
        dto.is_active,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(resource_ids) = dto.resource_ids {
        sqlx::query!(
            "DELETE FROM resource_contracts WHERE contract_id = $1",
            contract.id
        )
        .execute(&mut *tx)
        .await?;

        for res_id in resource_ids {
            sqlx::query!(
                "INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1, $2)",
                res_id,
                contract.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(contract)
}

/// Soft-deletes a contract document.
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

/// Replaces the resource bindings for a given contract.
pub async fn update_resource_bindings(
    pool: &PgPool,
    contract_id: Uuid,
    resource_ids: Vec<Uuid>,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        "DELETE FROM resource_contracts WHERE contract_id = $1",
        contract_id
    )
    .execute(&mut *tx)
    .await?;

    for res_id in resource_ids {
        sqlx::query!(
            "INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1, $2)",
            res_id,
            contract_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}
