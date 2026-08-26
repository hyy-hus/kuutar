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
        CreateOccurrencePayload, CreateReservationPayload, ListReservationsQuery, Occurrence,
        ReservationWithOccurrences, UpdateReservationPayload,
    },
};
use crate::{
    domains::{
        auth::{
            AuthState,
            extractor::{AuthUser, OptionalAuthUser},
        },
        users::models::Role,
    },
    errors::AppError,
};

// Maximum allowed search window range in days
const MAX_SEARCH_RANGE_DAYS: i64 = 91;

#[utoipa::path(
    get,
    path = "/reservations",
    tag = "Reservations",
    params(ListReservationsQuery),
    responses(
        (status = 200, description = "List of filtered reservations", body = [ReservationWithOccurrences]),
        (status = 400, description = "Invalid date window or range exceeds maximum limit"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, opt_user))]
pub async fn list_reservations(
    State(auth_state): State<AuthState>,
    opt_user: OptionalAuthUser,
    Query(query): Query<ListReservationsQuery>,
) -> Result<Json<Vec<ReservationWithOccurrences>>, AppError> {
    query.validate()?;

    if !query.validate_range(MAX_SEARCH_RANGE_DAYS) {
        return Err(AppError::BadRequest(format!(
            "Invalid date range: 'start_date' must be before 'end_date' and total span must not exceed {MAX_SEARCH_RANGE_DAYS} days."
        )));
    }

    let is_admin = opt_user.0.map(|u| u.role == Role::Admin).unwrap_or(false);

    let reservations = db::list_filtered(
        &auth_state.pool,
        query.start_date,
        query.end_date,
        query.resource_id,
        query.status,
        is_admin,
    )
    .await?;

    Ok(Json(reservations))
}

#[utoipa::path(
    get,
    path = "/reservations/{id}",
    tag = "Reservations",
    params(
        ("id" = Uuid, Path, description = "Reservation UUID")
    ),
    responses(
        (status = 200, description = "Reservation details", body = ReservationWithOccurrences),
        (status = 404, description = "Reservation not found")
    )
)]
#[tracing::instrument(skip(auth_state, opt_user))]
pub async fn get_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    opt_user: OptionalAuthUser,
) -> Result<Json<ReservationWithOccurrences>, AppError> {
    let is_admin = opt_user.0.map(|u| u.role == Role::Admin).unwrap_or(false);

    let reservation = db::find_by_id(&auth_state.pool, id, is_admin).await?;
    Ok(Json(reservation))
}

#[utoipa::path(
    post,
    path = "/reservations",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    request_body = CreateReservationPayload,
    responses(
        (status = 201, description = "Reservation created successfully", body = ReservationWithOccurrences),
        (status = 400, description = "Invalid occurrence interval times"),
        (status = 401, description = "Unauthorized"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn create_reservation(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
    Json(mut payload): Json<CreateReservationPayload>,
) -> Result<(StatusCode, Json<ReservationWithOccurrences>), AppError> {
    payload.validate()?;

    if auth_user.role != Role::Admin {
        payload.status = Some(super::models::ReservationStatus::Pending);
    }

    if !payload.validate_occurrence_times() {
        return Err(AppError::BadRequest(
            "Occurrence start_time must be before end_time".to_string(),
        ));
    }

    let reservation = db::create(&auth_state.pool, auth_user.id, payload).await?;
    Ok((StatusCode::CREATED, Json(reservation)))
}

#[utoipa::path(
    post,
    path = "/reservations/check-conflicts",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    request_body = [CreateOccurrencePayload],
    responses(
        (status = 200, description = "List of conflicting occurrences", body = [Occurrence]),
        (status = 401, description = "Unauthorized")
    )
)]
#[tracing::instrument(skip(auth_state, _auth_user))]
pub async fn check_reservation_conflicts(
    State(auth_state): State<AuthState>,
    _auth_user: AuthUser,
    Json(payload): Json<Vec<CreateOccurrencePayload>>,
) -> Result<Json<Vec<Occurrence>>, AppError> {
    let conflicts = db::check_conflicts(&auth_state.pool, &payload).await?;
    Ok(Json(conflicts))
}

#[utoipa::path(
    patch,
    path = "/reservations/{id}",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Reservation UUID")
    ),
    request_body = UpdateReservationPayload,
    responses(
        (status = 200, description = "Reservation updated successfully", body = ReservationWithOccurrences),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Reservation not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _auth_user))]
pub async fn update_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    _auth_user: AuthUser,
    Json(payload): Json<UpdateReservationPayload>,
) -> Result<Json<ReservationWithOccurrences>, AppError> {
    payload.validate()?;
    let reservation = db::update(&auth_state.pool, id, payload).await?;
    Ok(Json(reservation))
}

#[utoipa::path(
    delete,
    path = "/reservations/{id}",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Reservation UUID")
    ),
    responses(
        (status = 204, description = "Reservation soft-deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Reservation not found")
    )
)]
#[tracing::instrument(skip(auth_state, _auth_user))]
pub async fn delete_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    _auth_user: AuthUser,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
