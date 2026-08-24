use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{CreateGroup, Group, UpdateGroup},
};
use crate::{
    domains::auth::{
        AuthState,
        extractor::{AuthUser, RequireAdmin},
    },
    errors::AppError,
};

/// GET /groups
#[utoipa::path(
    get,
    path = "/groups",
    tag = "Groups",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List all active groups", body = [Group]),
        (status = 401, description = "Unauthorized")
    )
)]
#[tracing::instrument(skip(auth_state, _user))]
pub async fn list_groups(
    State(auth_state): State<AuthState>,
    _user: AuthUser,
) -> Result<Json<Vec<Group>>, AppError> {
    let groups = db::list_groups(&auth_state.pool).await?;
    Ok(Json(groups))
}

/// GET /groups/{id}
#[utoipa::path(
    get,
    path = "/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "Group ID")),
    responses(
        (status = 200, description = "Group details", body = Group),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Group not found")
    )
)]
#[tracing::instrument(skip(auth_state, _user))]
pub async fn get_group(
    State(auth_state): State<AuthState>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Group>, AppError> {
    let group = db::get_group(&auth_state.pool, id).await?;
    Ok(Json(group))
}

/// POST /groups
#[utoipa::path(
    post,
    path = "/groups",
    tag = "Groups",
    security(("bearer_auth" = [])),
    request_body = CreateGroup,
    responses(
        (status = 201, description = "Group created", body = Group),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 409, description = "Group name already exists"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn create_group(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateGroup>,
) -> Result<(StatusCode, Json<Group>), AppError> {
    payload.validate()?;
    let group = db::create_group(&auth_state.pool, &payload).await?;
    Ok((StatusCode::CREATED, Json(group)))
}

/// PATCH /groups/{id}
#[utoipa::path(
    patch,
    path = "/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "Group ID")),
    request_body = UpdateGroup,
    responses(
        (status = 200, description = "Group updated", body = Group),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Group not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn update_group(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGroup>,
) -> Result<Json<Group>, AppError> {
    payload.validate()?;
    let group = db::update_group(&auth_state.pool, id, &payload).await?;
    Ok(Json(group))
}

/// DELETE /groups/{id}
#[utoipa::path(
    delete,
    path = "/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "Group ID")),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Group not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_group(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::delete_group(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
