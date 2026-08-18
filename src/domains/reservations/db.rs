//! Database layer for the `reservations` domain.
//!
//! Handles all SQL queries for reservations and occurrences. All read and update
//! operations automatically exclude soft-deleted records (`deleted_at IS NULL`).

use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    CreateOccurrencePayload, CreateReservationPayload, Occurrence, Reservation, ReservationStatus,
    ReservationWithOccurrences, UpdateReservationPayload,
};
use crate::errors::AppError;

/// Fetches all active reservations for a group, including their associated occurrences.
pub async fn list_all_by_group(
    pool: &PgPool,
    group_id: Uuid,
) -> Result<Vec<ReservationWithOccurrences>, AppError> {
    let reservations = sqlx::query_as!(
        Reservation,
        r#"
        SELECT 
            id, group_id, user_id, title, description, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        FROM reservations
        WHERE group_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        "#,
        group_id
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(reservations.len());

    for reservation in reservations {
        let occurrences = fetch_occurrences_for_reservation(pool, reservation.id).await?;
        result.push(ReservationWithOccurrences {
            reservation,
            occurrences,
        });
    }

    Ok(result)
}

/// Fetches an active reservation by its ID, including all its occurrences.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the reservation does not exist or is soft-deleted.
pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
    group_id: Uuid,
) -> Result<ReservationWithOccurrences, AppError> {
    let reservation = sqlx::query_as!(
        Reservation,
        r#"
        SELECT 
            id, group_id, user_id, title, description, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        FROM reservations
        WHERE id = $1 AND group_id = $2 AND deleted_at IS NULL
        "#,
        id,
        group_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let occurrences = fetch_occurrences_for_reservation(pool, reservation.id).await?;

    Ok(ReservationWithOccurrences {
        reservation,
        occurrences,
    })
}

/// Creates a new reservation and batch inserts all occurrences within a single transaction.
///
/// # Errors
///
/// Returns [`AppError::BadRequest`] if an occurrence reference ID is invalid or time bounds fail constraints.
pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    group_id: Uuid,
    dto: CreateReservationPayload,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    let initial_status = dto.status.unwrap_or(ReservationStatus::Pending);

    let reservation = sqlx::query_as!(
        Reservation,
        r#"
        INSERT INTO reservations (group_id, user_id, title, description, rrule, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
            id, group_id, user_id, title, description, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        "#,
        group_id,
        user_id,
        dto.title,
        dto.description,
        dto.rrule,
        initial_status as ReservationStatus
    )
    .fetch_one(&mut *tx)
    .await?;

    let mut occurrences = Vec::with_capacity(dto.occurrences.len());

    for occ in dto.occurrences {
        let inserted = sqlx::query_as!(
            Occurrence,
            r#"
            INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            RETURNING id, reservation_id, resource_id, start_time, end_time, created_at
            "#,
            reservation.id,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .fetch_one(&mut *tx)
        .await?;

        occurrences.push(inserted);
    }

    tx.commit().await?;

    Ok(ReservationWithOccurrences {
        reservation,
        occurrences,
    })
}

/// Performs a partial update on reservation metadata.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the reservation does not exist or is soft-deleted.
pub async fn update(
    pool: &PgPool,
    id: Uuid,
    group_id: Uuid,
    dto: UpdateReservationPayload,
) -> Result<Reservation, AppError> {
    let reservation = sqlx::query_as!(
        Reservation,
        r#"
        UPDATE reservations
        SET 
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            rrule = COALESCE($3, rrule),
            status = COALESCE($4, status)
        WHERE id = $5 AND group_id = $6 AND deleted_at IS NULL
        RETURNING 
            id, group_id, user_id, title, description, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        "#,
        dto.title,
        dto.description,
        dto.rrule,
        dto.status as Option<ReservationStatus>,
        id,
        group_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(reservation)
}

/// Soft-deletes a reservation by setting its `deleted_at` timestamp.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if the reservation does not exist or was already deleted.
pub async fn soft_delete(pool: &PgPool, id: Uuid, group_id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE reservations
        SET deleted_at = NOW()
        WHERE id = $1 AND group_id = $2 AND deleted_at IS NULL
        "#,
        id,
        group_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// Helper function to fetch all occurrences associated with a reservation.
async fn fetch_occurrences_for_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<Vec<Occurrence>, AppError> {
    let occurrences = sqlx::query_as!(
        Occurrence,
        r#"
        SELECT id, reservation_id, resource_id, start_time, end_time, created_at
        FROM occurrences
        WHERE reservation_id = $1
        ORDER BY start_time ASC
        "#,
        reservation_id
    )
    .fetch_all(pool)
    .await?;

    Ok(occurrences)
}

/// Checks proposed occurrences against active non-cancelled occurrences for scheduling conflicts.
pub async fn check_conflicts(
    pool: &PgPool,
    proposed_occurrences: &[CreateOccurrencePayload],
) -> Result<Vec<Occurrence>, AppError> {
    let mut conflicting_occurrences = Vec::new();

    for proposed in proposed_occurrences {
        let conflicts = sqlx::query_as!(
            Occurrence,
            r#"
            SELECT o.id, o.reservation_id, o.resource_id, o.start_time, o.end_time, o.created_at
            FROM occurrences o
            JOIN reservations r ON r.id = o.reservation_id
            WHERE o.resource_id = $1
              AND r.deleted_at IS NULL
              AND r.status != 'cancelled'
              AND o.start_time < $3 
              AND o.end_time > $2
            "#,
            proposed.resource_id,
            proposed.start_time,
            proposed.end_time
        )
        .fetch_all(pool)
        .await?;

        conflicting_occurrences.extend(conflicts);
    }

    Ok(conflicting_occurrences)
}
