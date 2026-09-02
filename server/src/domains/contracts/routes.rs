use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{Contract, CreateContract, UpdateContract},
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

/// GET /contracts
#[utoipa::path(
    get,
    path = "/contracts",
    tag = "Contracts",
    responses(
        (status = 200, description = "List of active contracts", body = [Contract]),
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn list_contracts(
    State(auth_state): State<AuthState>,
) -> Result<Json<Vec<Contract>>, AppError> {
    let contracts = db::list_all(&auth_state.pool).await?;
    Ok(Json(contracts))
}

/// GET /contracts/{id}
#[utoipa::path(
    get,
    path = "/contracts/{id}",
    tag = "Contracts",
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    responses(
        (status = 200, description = "Contract details", body = Contract),
        (status = 404, description = "Contract not found")
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn get_contract(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Contract>, AppError> {
    let contract = db::find_by_id(&auth_state.pool, id).await?;
    Ok(Json(contract))
}

/// POST /contracts
#[utoipa::path(
    post,
    path = "/contracts",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    request_body = CreateContract,
    responses(
        (status = 201, description = "Contract created successfully", body = Contract),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 409, description = "Contract name conflict"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn create_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateContract>,
) -> Result<(StatusCode, Json<Contract>), AppError> {
    payload.validate()?;
    let contract = db::create(&auth_state.pool, payload).await?;

    Ok((StatusCode::CREATED, Json(contract)))
}

/// PATCH /contracts/{id}
#[utoipa::path(
    patch,
    path = "/contracts/{id}",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    request_body = UpdateContract,
    responses(
        (status = 200, description = "Contract updated successfully", body = Contract),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Contract not found"),
        (status = 409, description = "Contract name conflict"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn update_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateContract>,
) -> Result<Json<Contract>, AppError> {
    payload.validate()?;
    let contract = db::update(&auth_state.pool, id, payload).await?;

    Ok(Json(contract))
}

/// DELETE /contracts/{id}
#[utoipa::path(
    delete,
    path = "/contracts/{id}",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    responses(
        (status = 204, description = "Contract soft-deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Contract not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
