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

    let is_admin = opt_user
        .0
        .as_ref()
        .map(|u| u.role == Role::Admin)
        .unwrap_or(false);
    let current_user_id = opt_user.0.as_ref().map(|u| u.id);

    let reservations = db::list_filtered(
        &auth_state.pool,
        query.start_date,
        query.end_date,
        query.resource_id,
        query.status,
        is_admin,
        current_user_id,
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
        (status = 403, description = "Forbidden - Admin role required"),
        (status = 404, description = "Reservation not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn update_reservation(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
    auth_user: AuthUser,
    Json(mut payload): Json<UpdateReservationPayload>,
) -> Result<Json<ReservationWithOccurrences>, AppError> {
    tracing::info!(
        reservation_id = %id,
        user_id = %auth_user.id,
        user_role = ?auth_user.role,
        "Attempting reservation update"
    );

    payload.validate()?;

    // Fetch existing reservation using system/admin flag to get user_id safely
    let existing = match db::find_by_id(&auth_state.pool, id, true).await {
        Ok(res) => res,
        Err(err) => {
            tracing::error!(reservation_id = %id, error = ?err, "Failed to find existing reservation in DB");
            return Err(err);
        }
    };

    tracing::info!(
        reservation_id = %id,
        existing_owner_id = %existing.reservation.user_id,
        request_user_id = %auth_user.id,
        existing_status = ?existing.reservation.status,
        payload_status = ?payload.status,
        "Found existing reservation"
    );

    if auth_user.role != Role::Admin {
        // 1. Verify ownership
        let is_owner = existing.reservation.user_id == auth_user.id;
        tracing::info!(
            reservation_id = %id,
            is_owner = %is_owner,
            "Evaluating ownership check"
        );

        if !is_owner {
            tracing::warn!(
                reservation_id = %id,
                existing_owner_id = %existing.reservation.user_id,
                request_user_id = %auth_user.id,
                "FORBIDDEN: User does not own this reservation"
            );
            return Err(AppError::Forbidden(
                "Et voi muokata toisen käyttäjän varausta.".to_string(),
            ));
        }

        // 2. Determine if this request is ONLY trying to cancel
        let has_title_edit = payload.title.is_some();
        let has_description_edit = payload.description.is_some();
        let has_occurrences_edit = payload.occurrences.is_some();
        let has_rrule_edit = payload.rrule.is_some();
        let is_status_cancelled =
            payload.status == Some(super::models::ReservationStatus::Cancelled);

        let is_pure_cancellation = is_status_cancelled
            && !has_title_edit
            && !has_description_edit
            && !has_occurrences_edit
            && !has_rrule_edit;

        tracing::info!(
            reservation_id = %id,
            is_pure_cancellation = %is_pure_cancellation,
            has_title_edit = %has_title_edit,
            has_description_edit = %has_description_edit,
            has_occurrences_edit = %has_occurrences_edit,
            has_rrule_edit = %has_rrule_edit,
            is_status_cancelled = %is_status_cancelled,
            "Evaluated non-admin edit permissions"
        );

        if is_pure_cancellation {
            tracing::info!(reservation_id = %id, "Processing pure cancellation request for non-admin owner");
            payload.status = Some(super::models::ReservationStatus::Cancelled);
        } else {
            tracing::info!(
                reservation_id = %id,
                "Processing content/time edits by non-admin owner: forcing status to Pending & clearing print status"
            );
            payload.status = Some(super::models::ReservationStatus::Pending);
            payload.mark_printed = Some(false);
        }

        // Always block non-admins from modifying admin_notes
        payload.admin_notes = None;
    } else {
        tracing::info!(reservation_id = %id, "Executing update as Admin");
    }

    let reservation = match db::update(&auth_state.pool, id, payload).await {
        Ok(res) => res,
        Err(err) => {
            tracing::error!(reservation_id = %id, error = ?err, "DB update failed");
            return Err(err);
        }
    };

    tracing::info!(reservation_id = %id, "Reservation successfully updated");
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
