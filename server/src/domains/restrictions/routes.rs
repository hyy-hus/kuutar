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
        CreateRestrictionPayload, ListRestrictionsQuery, RestrictionWithOccurrences,
        UpdateRestrictionPayload,
    },
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

#[utoipa::path(
    get,
    path = "/restrictions",
    tag = "Restrictions",
    params(ListRestrictionsQuery),
    responses((status = 200, body = [RestrictionWithOccurrences]))
)]
pub async fn list_restrictions(
    State(auth_state): State<AuthState>,
    Query(query): Query<ListRestrictionsQuery>,
) -> Result<Json<Vec<RestrictionWithOccurrences>>, AppError> {
    let start_date = query.start_date.unwrap_or_else(chrono::Utc::now);
    let end_date = query
        .end_date
        .unwrap_or_else(|| start_date + chrono::TimeDelta::days(30));

    let restrictions =
        db::list_filtered(&auth_state.pool, start_date, end_date, query.resource_id).await?;
    Ok(Json(restrictions))
}

#[utoipa::path(
    get,
    path = "/restrictions/{id}",
    tag = "Restrictions",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = RestrictionWithOccurrences), (status = 404))
)]
pub async fn get_restriction(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RestrictionWithOccurrences>, AppError> {
    let restriction = db::find_by_id(&auth_state.pool, id).await?;
    Ok(Json(restriction))
}

#[utoipa::path(
    post,
    path = "/restrictions",
    tag = "Restrictions",
    security(("bearer_auth" = [])),
    request_body = CreateRestrictionPayload,
    responses((status = 201, body = RestrictionWithOccurrences), (status = 403))
)]
pub async fn create_restriction(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateRestrictionPayload>,
) -> Result<(StatusCode, Json<RestrictionWithOccurrences>), AppError> {
    payload.validate()?;

    if !payload.validate_times() {
        return Err(AppError::BadRequest(
            "Restriction occurrence start_time must be before end_time".to_string(),
        ));
    }

    let restriction = db::create(&auth_state.pool, payload).await?;
    Ok((StatusCode::CREATED, Json(restriction)))
}

#[utoipa::path(
    patch,
    path = "/restrictions/{id}",
    tag = "Restrictions",
    security(("bearer_auth" = [])),
    request_body = UpdateRestrictionPayload,
    responses((status = 200, body = RestrictionWithOccurrences), (status = 403), (status = 404))
)]
pub async fn update_restriction(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRestrictionPayload>,
) -> Result<Json<RestrictionWithOccurrences>, AppError> {
    payload.validate()?;
    let restriction = db::update(&auth_state.pool, id, payload).await?;
    Ok(Json(restriction))
}

#[utoipa::path(
    delete,
    path = "/restrictions/{id}",
    tag = "Restrictions",
    security(("bearer_auth" = [])),
    responses((status = 204), (status = 403), (status = 404))
)]
pub async fn delete_restriction(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
