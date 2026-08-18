use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{
        CreateOccurrencePayload, CreateReservationPayload, Occurrence, Reservation,
        ReservationWithOccurrences, UpdateReservationPayload,
    },
};
use crate::{
    domains::auth::{AuthState, extractor::AuthUser},
    errors::AppError,
};

/// GET /reservations
#[utoipa::path(
    get,
    path = "/reservations",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of active reservations", body = [ReservationWithOccurrences]),
        (status = 401, description = "Unauthorized")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn list_reservations(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<ReservationWithOccurrences>>, AppError> {
    let reservations = db::list_all_by_group(&auth_state.pool, auth_user.group_id).await?;
    Ok(Json(reservations))
}

/// GET /reservations/{id}
#[utoipa::path(
    get,
    path = "/reservations/{id}",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Reservation UUID")
    ),
    responses(
        (status = 200, description = "Reservation details", body = ReservationWithOccurrences),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Reservation not found")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn get_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<ReservationWithOccurrences>, AppError> {
    let reservation = db::find_by_id(&auth_state.pool, id, auth_user.group_id).await?;
    Ok(Json(reservation))
}

/// POST /reservations
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
    Json(payload): Json<CreateReservationPayload>,
) -> Result<(StatusCode, Json<ReservationWithOccurrences>), AppError> {
    payload.validate()?;

    if !payload.validate_occurrence_times() {
        return Err(AppError::BadRequest(
            "Occurrence start_time must be before end_time".to_string(),
        ));
    }

    let reservation =
        db::create(&auth_state.pool, auth_user.id, auth_user.group_id, payload).await?;
    Ok((StatusCode::CREATED, Json(reservation)))
}

/// POST /reservations/check-conflicts
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

/// PATCH /reservations/{id}
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
        (status = 200, description = "Reservation updated successfully", body = Reservation),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Reservation not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn update_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    auth_user: AuthUser,
    Json(payload): Json<UpdateReservationPayload>,
) -> Result<Json<Reservation>, AppError> {
    payload.validate()?;
    let reservation = db::update(&auth_state.pool, id, auth_user.group_id, payload).await?;
    Ok(Json(reservation))
}

/// DELETE /reservations/{id}
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
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn delete_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id, auth_user.group_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
