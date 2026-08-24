use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{CreateResource, Resource, UpdateResource},
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

/// GET /resources
#[utoipa::path(
    get,
    path = "/resources",
    tag = "Resources",
    responses(
        (status = 200, description = "List of active resources", body = [Resource]),
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn list_resources(
    State(auth_state): State<AuthState>,
) -> Result<Json<Vec<Resource>>, AppError> {
    let resources = db::list_all(&auth_state.pool).await?;
    Ok(Json(resources))
}

/// GET /resources/{id}
#[utoipa::path(
    get,
    path = "/resources/{id}",
    tag = "Resources",
    params(
        ("id" = Uuid, Path, description = "Resource UUID")
    ),
    responses(
        (status = 200, description = "Resource details", body = Resource),
        (status = 404, description = "Resource not found")
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn get_resource(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, AppError> {
    let resource = db::find_by_id(&auth_state.pool, id).await?;
    Ok(Json(resource))
}

/// POST /resources
#[utoipa::path(
    post,
    path = "/resources",
    tag = "Resources",
    security(("bearer_auth" = [])),
    request_body = CreateResource,
    responses(
        (status = 201, description = "Resource created successfully", body = Resource),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 409, description = "Resource name conflict in collection"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn create_resource(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateResource>,
) -> Result<(StatusCode, Json<Resource>), AppError> {
    payload.validate()?;
    let resource = db::create(&auth_state.pool, payload).await?;

    Ok((StatusCode::CREATED, Json(resource)))
}

/// PATCH /resources/{id}
#[utoipa::path(
    patch,
    path = "/resources/{id}",
    tag = "Resources",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Resource UUID")
    ),
    request_body = UpdateResource,
    responses(
        (status = 200, description = "Resource updated successfully", body = Resource),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Resource not found"),
        (status = 409, description = "Resource name conflict"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn update_resource(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateResource>,
) -> Result<Json<Resource>, AppError> {
    payload.validate()?;
    let resource = db::update(&auth_state.pool, id, payload).await?;

    Ok(Json(resource))
}

/// DELETE /resources/{id}
#[utoipa::path(
    delete,
    path = "/resources/{id}",
    tag = "Resources",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Resource UUID")
    ),
    responses(
        (status = 204, description = "Resource soft-deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Resource not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_resource(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
