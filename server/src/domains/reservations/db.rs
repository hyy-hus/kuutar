use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    CreateOccurrencePayload, CreateReservationPayload, Occurrence, Reservation, ReservationStatus,
    ReservationWithOccurrences, UpdateReservationPayload,
};
use crate::errors::AppError;

pub async fn list_filtered(
    pool: &PgPool,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    resource_id: Option<Uuid>,
    status: Option<ReservationStatus>,
    is_admin: bool,
) -> Result<Vec<ReservationWithOccurrences>, AppError> {
    // 1. Fetch distinct reservation IDs that have occurrences within the date/resource filter
    let reservation_ids = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT r.id
        FROM reservations r
        JOIN occurrences o ON o.reservation_id = r.id
        WHERE r.deleted_at IS NULL
          AND o.start_time < $2
          AND o.end_time > $1
          AND ($3::uuid IS NULL OR o.resource_id = $3)
          AND ($4::reservation_status IS NULL OR r.status = $4)
        "#,
        start_date,
        end_date,
        resource_id,
        status as Option<ReservationStatus> // Type annotation for sqlx custom enum
    )
    .fetch_all(pool)
    .await?;

    if reservation_ids.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Fetch the reservation metadata
    let reservations = sqlx::query_as!(
        Reservation,
        r#"
        SELECT 
            id, user_id, title, description, admin_notes, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        FROM reservations
        WHERE id = ANY($1) AND deleted_at IS NULL
        ORDER BY created_at DESC
        "#,
        &reservation_ids
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(reservations.len());

    for mut reservation in reservations {
        if !is_admin {
            reservation.admin_notes = None;
        }
        // Fetch occurrences within the specified range for this reservation
        let occurrences = fetch_occurrences_for_reservation_filtered(
            pool,
            reservation.id,
            start_date,
            end_date,
            resource_id,
        )
        .await?;

        result.push(ReservationWithOccurrences {
            reservation,
            occurrences,
        });
    }

    Ok(result)
}

pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
    is_admin: bool,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut reservation = sqlx::query_as!(
        Reservation,
        r#"
        SELECT 
            id, user_id, title, description, admin_notes, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        FROM reservations
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if !is_admin {
        reservation.admin_notes = None;
    }

    let occurrences = fetch_occurrences_for_reservation(pool, reservation.id).await?;

    Ok(ReservationWithOccurrences {
        reservation,
        occurrences,
    })
}

pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    dto: CreateReservationPayload,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    let initial_status = dto.status.unwrap_or(ReservationStatus::Pending);

    let reservation = sqlx::query_as!(
        Reservation,
        r#"
        INSERT INTO reservations (user_id, title, description, admin_notes, rrule, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
            id, user_id, title, description, admin_notes, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        "#,
        user_id,
        dto.title,
        dto.description,
        dto.admin_notes,
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

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    dto: UpdateReservationPayload,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    // 1. Update reservation metadata
    let reservation = sqlx::query_as!(
        Reservation,
        r#"
        UPDATE reservations
        SET 
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            admin_notes = COALESCE($3, admin_notes),
            rrule = COALESCE($4, rrule),
            status = COALESCE($5, status)
        WHERE id = $6 AND deleted_at IS NULL
        RETURNING 
            id, user_id, title, description, admin_notes, rrule, 
            status AS "status: ReservationStatus", created_at, updated_at
        "#,
        dto.title,
        dto.description,
        dto.admin_notes,
        dto.rrule,
        dto.status as Option<ReservationStatus>,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(new_occurrences) = dto.occurrences {
        sqlx::query!(r#"DELETE FROM occurrences WHERE reservation_id = $1"#, id)
            .execute(&mut *tx)
            .await?;

        for occ in new_occurrences {
            sqlx::query!(
                r#"
                INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
                VALUES ($1, $2, $3, $4)
                "#,
                id,
                occ.resource_id,
                occ.start_time,
                occ.end_time
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    let occurrences = fetch_occurrences_for_reservation(pool, id).await?;

    Ok(ReservationWithOccurrences {
        reservation,
        occurrences,
    })
}

pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE reservations
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

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

async fn fetch_occurrences_for_reservation_filtered(
    pool: &PgPool,
    reservation_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    resource_id: Option<Uuid>,
) -> Result<Vec<Occurrence>, AppError> {
    let occurrences = sqlx::query_as!(
        Occurrence,
        r#"
        SELECT id, reservation_id, resource_id, start_time, end_time, created_at
        FROM occurrences
        WHERE reservation_id = $1
          AND start_time < $3
          AND end_time > $2
          AND ($4::uuid IS NULL OR resource_id = $4)
        ORDER BY start_time ASC
        "#,
        reservation_id,
        start_date,
        end_date,
        resource_id
    )
    .fetch_all(pool)
    .await?;

    Ok(occurrences)
}

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
