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
    models::{Collection, CreateCollection, UpdateCollection},
};
use crate::errors::AppError;

/// GET /api/collections
#[tracing::instrument(skip(pool))]
pub async fn list_collections(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Collection>>, AppError> {
    let collections = db::list_all(&pool).await?;
    Ok(Json(collections))
}

/// GET /api/collections/{id}
#[tracing::instrument(skip(pool))]
pub async fn get_collection(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Collection>, AppError> {
    let collection = db::find_by_id(&pool, id).await?;
    Ok(Json(collection))
}

/// POST /api/collections
#[tracing::instrument(skip(pool))]
pub async fn create_collection(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateCollection>,
) -> Result<(StatusCode, Json<Collection>), AppError> {
    payload.validate()?;
    let collection = db::create(&pool, payload).await?;
    Ok((StatusCode::CREATED, Json(collection)))
}

/// PATCH /api/collections/{id}
#[tracing::instrument(skip(pool))]
pub async fn update_collection(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCollection>,
) -> Result<Json<Collection>, AppError> {
    payload.validate()?;
    let collection = db::update(&pool, id, payload).await?;
    Ok(Json(collection))
}

/// DELETE /api/collections/{id}
#[tracing::instrument(skip(pool))]
pub async fn delete_collection(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
