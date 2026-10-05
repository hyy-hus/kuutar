use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{
        CreateReservableBlockPayload, ListReservableBlocksQuery, ReservableBlockWithOccurrences,
        UpdateReservableBlockPayload,
    },
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

#[utoipa::path(
    get,
    path = "/reservable-blocks",
    tag = "Reservable blocks",
    params(ListReservableBlocksQuery),
    responses((status = 200, body = [ReservableBlockWithOccurrences]))
)]
pub async fn list_reservable_blocks(
    State(auth_state): State<AuthState>,
    Query(query): Query<ListReservableBlocksQuery>,
) -> Result<Json<Vec<ReservableBlockWithOccurrences>>, AppError> {
    let start_date = query.start_date.unwrap_or_else(chrono::Utc::now);
    let end_date = query
        .end_date
        .unwrap_or_else(|| start_date + chrono::TimeDelta::days(30));

    let blocks =
        db::list_filtered(&auth_state.pool, start_date, end_date, query.resource_id).await?;
    Ok(Json(blocks))
}

#[utoipa::path(
    get,
    path = "/reservable-blocks/{id}",
    tag = "Reservable blocks",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = ReservableBlockWithOccurrences), (status = 404))
)]
pub async fn get_reservable_block(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReservableBlockWithOccurrences>, AppError> {
    Ok(Json(db::find_by_id(&auth_state.pool, id).await?))
}

#[utoipa::path(
    post,
    path = "/reservable-blocks",
    tag = "Reservable blocks",
    security(("bearer_auth" = [])),
    request_body = CreateReservableBlockPayload,
    responses((status = 201, body = ReservableBlockWithOccurrences), (status = 400), (status = 403))
)]
pub async fn create_reservable_block(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateReservableBlockPayload>,
) -> Result<(StatusCode, Json<ReservableBlockWithOccurrences>), AppError> {
    payload.validate()?;

    if !payload.validate_times() {
        return Err(AppError::BadRequest(
            "Block occurrence start_time must be before end_time".to_string(),
        ));
    }

    let resource_ids: Vec<Uuid> = payload.occurrences.iter().map(|o| o.resource_id).collect();
    db::ensure_blocks_only_resources(&auth_state.pool, &resource_ids).await?;

    let block = db::create(&auth_state.pool, payload).await?;
    Ok((StatusCode::CREATED, Json(block)))
}

#[utoipa::path(
    patch,
    path = "/reservable-blocks/{id}",
    tag = "Reservable blocks",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    request_body = UpdateReservableBlockPayload,
    responses((status = 200, body = ReservableBlockWithOccurrences), (status = 400), (status = 403), (status = 404))
)]
pub async fn update_reservable_block(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateReservableBlockPayload>,
) -> Result<Json<ReservableBlockWithOccurrences>, AppError> {
    payload.validate()?;

    if !payload.validate_times() {
        return Err(AppError::BadRequest(
            "Block occurrence start_time must be before end_time".to_string(),
        ));
    }

    if let Some(occurrences) = &payload.occurrences {
        let resource_ids: Vec<Uuid> = occurrences.iter().map(|o| o.resource_id).collect();
        db::ensure_blocks_only_resources(&auth_state.pool, &resource_ids).await?;
    }

    Ok(Json(db::update(&auth_state.pool, id, payload).await?))
}

#[utoipa::path(
    delete,
    path = "/reservable-blocks/{id}",
    tag = "Reservable blocks",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 403), (status = 404))
)]
pub async fn delete_reservable_block(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
