use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{CreateResource, Resource, UpdateResource},
};

use crate::errors::AppError;

/// GET /api/resources
#[tracing::instrument(skip(pool))]
pub async fn list_resources(State(pool): State<PgPool>) -> Result<Json<Vec<Resource>>, AppError> {
    let resources = db::list_all(&pool).await?;
    Ok(Json(resources))
}

/// GET /api/resources/:id
#[tracing::instrument(skip(pool))]
pub async fn get_resource(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, AppError> {
    let resource = db::find_by_id(&pool, id).await?;
    Ok(Json(resource))
}

/// POST /api/resources
#[tracing::instrument(skip(pool))]
pub async fn create_resource(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateResource>,
) -> Result<(StatusCode, Json<Resource>), AppError> {
    payload.validate()?;
    let resource = db::create(&pool, payload).await?;

    Ok((StatusCode::CREATED, Json(resource)))
}

/// PATCH /api/resources/:id
#[tracing::instrument(skip(pool))]
pub async fn update_resource(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateResource>,
) -> Result<Json<Resource>, AppError> {
    payload.validate()?;
    let resource = db::update(&pool, id, payload).await?;

    Ok(Json(resource))
}

/// DELETE /api/resources/:id
#[tracing::instrument(skip(pool))]
pub async fn delete_resource(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
