use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{Collection, CreateCollection, UpdateCollection},
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

/// GET /collections
#[utoipa::path(
    get,
    path = "/collections",
    tag = "Collections",
    responses(
        (status = 200, description = "List of active collections", body = [Collection]),
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn list_collections(
    State(auth_state): State<AuthState>,
) -> Result<Json<Vec<Collection>>, AppError> {
    let collections = db::list_all(&auth_state.pool).await?;
    Ok(Json(collections))
}

/// GET /collections/{id}
#[utoipa::path(
    get,
    path = "/collections/{id}",
    tag = "Collections",
    params(
        ("id" = Uuid, Path, description = "Collection UUID")
    ),
    responses(
        (status = 200, description = "Collection details", body = Collection),
        (status = 404, description = "Collection not found")
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn get_collection(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Collection>, AppError> {
    let collection = db::find_by_id(&auth_state.pool, id).await?;
    Ok(Json(collection))
}

/// POST /collections
#[utoipa::path(
    post,
    path = "/collections",
    tag = "Collections",
    security(("bearer_auth" = [])),
    request_body = CreateCollection,
    responses(
        (status = 201, description = "Collection created successfully", body = Collection),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 409, description = "Collection name conflict"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn create_collection(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateCollection>,
) -> Result<(StatusCode, Json<Collection>), AppError> {
    payload.validate()?;
    let collection = db::create(&auth_state.pool, payload).await?;
    Ok((StatusCode::CREATED, Json(collection)))
}

/// PATCH /collections/{id}
#[utoipa::path(
    patch,
    path = "/collections/{id}",
    tag = "Collections",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Collection UUID")
    ),
    request_body = UpdateCollection,
    responses(
        (status = 200, description = "Collection updated successfully", body = Collection),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Collection not found"),
        (status = 409, description = "Collection name conflict"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn update_collection(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCollection>,
) -> Result<Json<Collection>, AppError> {
    payload.validate()?;
    let collection = db::update(&auth_state.pool, id, payload).await?;
    Ok(Json(collection))
}

/// DELETE /collections/{id}
#[utoipa::path(
    delete,
    path = "/collections/{id}",
    tag = "Collections",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Collection UUID")
    ),
    responses(
        (status = 204, description = "Collection soft-deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Collection not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_collection(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
