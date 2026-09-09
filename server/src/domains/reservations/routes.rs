use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use sqlx::PgPool;
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

const MAX_SEARCH_RANGE_DAYS: i64 = 91;

/// Helper function to check if non-admin users are creating recurring reservations
/// on resources that explicitly allow recurrence.
async fn validate_recurring_permission(
    pool: &PgPool,
    payload: &CreateReservationPayload,
    user_role: Role,
) -> Result<(), AppError> {
    // Admins bypass recurrence checks; non-recurring requests require no check
    if user_role == Role::Admin || payload.rrule.is_none() {
        return Ok(());
    }

    // Extract all unique resource IDs across the occurrences
    let resource_ids: Vec<Uuid> = payload
        .occurrences
        .iter()
        .map(|occ| occ.resource_id)
        .collect();

    if resource_ids.is_empty() {
        return Ok(());
    }

    // Query for any selected resources where allow_recurring is false
    let invalid_resources = sqlx::query!(
        r#"
        SELECT name 
        FROM resources 
        WHERE id = ANY($1) AND allow_recurring = FALSE AND deleted_at IS NULL
        "#,
        &resource_ids
    )
    .fetch_all(pool)
    .await?;

    if !invalid_resources.is_empty() {
        let names: Vec<String> = invalid_resources.into_iter().map(|r| r.name).collect();
        return Err(AppError::Forbidden(format!(
            "Toistuvat varaukset eivät ole sallittuja seuraaville resursseille: {}",
            names.join(", ")
        )));
    }

    Ok(())
}

#[utoipa::path(
    get,
    path = "/reservations",
    tag = "Reservations",
    params(ListReservationsQuery),
    responses(
        (status = 200, description = "Public calendar reservations", body = [ReservationWithOccurrences]),
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
            "Invalid date range: max span is {MAX_SEARCH_RANGE_DAYS} days."
        )));
    }

    let start_date = query.start_date.unwrap_or_else(chrono::Utc::now);
    let end_date = query
        .end_date
        .unwrap_or_else(|| start_date + chrono::TimeDelta::days(30));
    let is_admin = opt_user.0.map(|u| u.role == Role::Admin).unwrap_or(false);

    let reservations = db::list_filtered(
        &auth_state.pool,
        start_date,
        end_date,
        query.resource_id,
        query.status,
        is_admin,
        None,
    )
    .await?;

    Ok(Json(reservations))
}

#[utoipa::path(
    get,
    path = "/reservations/me",
    tag = "Reservations",
    security(("bearer_auth" = [])),
    params(ListReservationsQuery),
    responses(
        (status = 200, description = "Current user's own reservations", body = [ReservationWithOccurrences]),
        (status = 401, description = "Unauthorized")
    )
)]
#[tracing::instrument(skip(auth_state, auth_user))]
pub async fn list_my_reservations(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
    Query(query): Query<ListReservationsQuery>,
) -> Result<Json<Vec<ReservationWithOccurrences>>, AppError> {
    query.validate()?;

    if !query.validate_range(MAX_SEARCH_RANGE_DAYS) {
        return Err(AppError::BadRequest(format!(
            "Invalid date range: max span is {MAX_SEARCH_RANGE_DAYS} days."
        )));
    }

    let start_date = query.start_date.unwrap_or_else(chrono::Utc::now);
    let end_date = query
        .end_date
        .unwrap_or_else(|| start_date + chrono::TimeDelta::days(30));
    let is_admin = auth_user.role == Role::Admin;

    let reservations = db::list_filtered(
        &auth_state.pool,
        start_date,
        end_date,
        query.resource_id,
        query.status,
        is_admin,
        Some(auth_user.id),
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
        (status = 403, description = "Forbidden - Recurrence disallowed for one or more resources"),
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

    // 1. Validate recurring permissions for non-admins
    validate_recurring_permission(&auth_state.pool, &payload, auth_user.role).await?;

    // 2. Default status for non-admin users to Pending
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
        (status = 403, description = "Forbidden - Admin access required"),
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
    payload.validate()?;

    let existing = db::find_by_id(&auth_state.pool, id, true).await?;

    if auth_user.role != Role::Admin {
        if existing.reservation.user_id != auth_user.id {
            return Err(AppError::Forbidden(
                "Et voi muokata toisen käyttäjän varausta.".to_string(),
            ));
        }

        let is_cancelling = payload.status == Some(super::models::ReservationStatus::Cancelled)
            && payload.title.is_none()
            && payload.description.is_none()
            && payload.occurrences.is_none()
            && payload.rrule.is_none();

        if is_cancelling {
            payload.status = Some(super::models::ReservationStatus::Cancelled);
        } else {
            payload.status = Some(super::models::ReservationStatus::Pending);
            payload.mark_printed = Some(false);
        }

        payload.admin_notes = None;
    }

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
