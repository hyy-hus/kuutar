use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{
    CreateOccurrencePayload, CreateReservationPayload, Occurrence, Reservation, ReservationStatus,
    ReservationWithOccurrences, UpdateReservationPayload,
};
use crate::{
    domains::reservations::models::{BatchImportReport, PortableReservationImport},
    errors::AppError,
};

pub async fn list_filtered(
    pool: &PgPool,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    resource_id: Option<Uuid>,
    status: Option<ReservationStatus>,
    is_admin: bool,
    target_user_id: Option<Uuid>,
) -> Result<Vec<ReservationWithOccurrences>, AppError> {
    let reservation_ids = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT r.id
        FROM reservations r
        LEFT JOIN occurrences o ON o.reservation_id = r.id
        WHERE r.deleted_at IS NULL
          AND o.start_time < $2
          AND o.end_time > $1
          AND ($3::uuid IS NULL OR o.resource_id = $3)
          AND ($4::reservation_status IS NULL OR r.status = $4)
          AND ($5::uuid IS NULL OR r.user_id = $5)
        "#,
        start_date,
        end_date,
        resource_id,
        status as Option<ReservationStatus>,
        target_user_id
    )
    .fetch_all(pool)
    .await?;

    if reservation_ids.is_empty() {
        return Ok(Vec::new());
    }

    let reservations = sqlx::query_as!(
        Reservation,
        r#"
        SELECT 
            r.id, 
            r.user_id,
            u.name AS "user_name?",
            u.email AS "user_email?",
            r.title, 
            r.description, 
            r.admin_notes,
            r.contact_person, 
            r.contact_email, 
            r.contact_phone,
            r.rrule, 
            r.status AS "status: ReservationStatus",
            r.source,
            r.contract_id, 
            r.contract_printed_at,
            r.cancelled_at,
            r.cancelled_by,
            r.cancel_reason,
            r.created_at, 
            r.updated_at
        FROM reservations r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.id = ANY($1) AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC
        "#,
        &reservation_ids
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(reservations.len());

    for mut reservation in reservations {
        // Strip admin-only fields if requestor is not an admin
        if !is_admin {
            reservation.user_email = None;
            reservation.admin_notes = None;
            // Owners (the "my reservations" listing) may see their own contact details
            if target_user_id != Some(reservation.user_id) {
                reservation.contact_person = None;
                reservation.contact_email = None;
                reservation.contact_phone = None;
            }
        }

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
            r.id, 
            r.user_id,
            u.name AS "user_name?",
            u.email AS "user_email?",
            r.title, 
            r.description, 
            r.admin_notes,
            r.contact_person, 
            r.contact_email, 
            r.contact_phone,
            r.rrule, 
            r.status AS "status: ReservationStatus",
            r.source,
            r.contract_id, 
            r.contract_printed_at,
            r.cancelled_at,
            r.cancelled_by,
            r.cancel_reason,
            r.created_at, 
            r.updated_at
        FROM reservations r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.id = $1 AND r.deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if !is_admin {
        reservation.user_email = None;
        reservation.admin_notes = None;
        reservation.contact_person = None;
        reservation.contact_email = None;
        reservation.contact_phone = None;
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
    enforce_blocks: bool,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    if enforce_blocks {
        validate_block_only_occurrences(&mut tx, None, dto.rrule.as_deref(), &dto.occurrences)
            .await?;
    }

    let initial_status = dto.status.unwrap_or(ReservationStatus::Pending);

    let reservation_id = sqlx::query_scalar!(
        r#"
        INSERT INTO reservations (
            user_id, title, description, admin_notes, 
            contact_person, contact_email, contact_phone, 
            rrule, status, contract_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        "#,
        user_id,
        dto.title,
        dto.description,
        dto.admin_notes,
        dto.contact_person,
        dto.contact_email,
        dto.contact_phone,
        dto.rrule,
        initial_status as ReservationStatus,
        dto.contract_id
    )
    .fetch_one(&mut *tx)
    .await?;

    for occ in dto.occurrences {
        sqlx::query!(
            r#"
            INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            "#,
            reservation_id,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    find_by_id(pool, reservation_id, true).await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    dto: UpdateReservationPayload,
    enforce_blocks: bool,
) -> Result<ReservationWithOccurrences, AppError> {
    let mut tx = pool.begin().await?;

    if enforce_blocks && let Some(new_occurrences) = &dto.occurrences {
        validate_block_only_occurrences(&mut tx, Some(id), dto.rrule.as_deref(), new_occurrences)
            .await?;
    }

    let result = sqlx::query!(
        r#"
        UPDATE reservations
        SET 
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            admin_notes = COALESCE($3, admin_notes),
            contact_person = COALESCE($4, contact_person),
            contact_email = COALESCE($5, contact_email),
            contact_phone = COALESCE($6, contact_phone),
            rrule = COALESCE($7, rrule),
            status = COALESCE($8, status),
            cancelled_at = CASE WHEN $8 IS NOT NULL AND $8 <> 'cancelled'::reservation_status THEN NULL ELSE cancelled_at END,
            cancelled_by = CASE WHEN $8 IS NOT NULL AND $8 <> 'cancelled'::reservation_status THEN NULL ELSE cancelled_by END,
            cancel_reason = CASE WHEN $8 IS NOT NULL AND $8 <> 'cancelled'::reservation_status THEN NULL ELSE cancel_reason END,
            contract_id = COALESCE($9, contract_id),
            contract_printed_at = CASE 
                WHEN $10 = TRUE THEN NOW() 
                WHEN $10 = FALSE THEN NULL
                ELSE contract_printed_at 
            END,
            updated_at = NOW()
        WHERE id = $11 AND deleted_at IS NULL
        "#,
        dto.title,
        dto.description,
        dto.admin_notes,
        dto.contact_person,
        dto.contact_email,
        dto.contact_phone,
        dto.rrule,
        dto.status as Option<ReservationStatus>,
        dto.contract_id,
        dto.mark_printed,
        id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

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

    find_by_id(pool, id, true).await
}

/// Marks a reservation as cancelled and records who did it and why.
/// Returns `Conflict` if it is already cancelled.
pub async fn cancel(
    pool: &PgPool,
    id: Uuid,
    cancelled_by: Uuid,
    reason: Option<String>,
) -> Result<ReservationWithOccurrences, AppError> {
    let reason = reason
        .map(|r| r.trim().to_string())
        .filter(|r| !r.is_empty());

    let result = sqlx::query!(
        r#"
        UPDATE reservations
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = $2,
            cancel_reason = $3,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
        "#,
        id,
        cancelled_by,
        reason
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::Conflict("Varaus on jo peruttu.".to_string()));
    }

    find_by_id(pool, id, true).await
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
    exclude_reservation_id: Option<Uuid>,
    include_pending: bool,
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
              AND (r.status = 'confirmed' OR ($5 AND r.status = 'pending'))
              AND ($4::uuid IS NULL OR r.id <> $4)
              AND o.start_time < $3 
              AND o.end_time > $2
            "#,
            proposed.resource_id,
            proposed.start_time,
            proposed.end_time,
            exclude_reservation_id,
            include_pending
        )
        .fetch_all(pool)
        .await?;

        conflicting_occurrences.extend(conflicts);
    }

    Ok(conflicting_occurrences)
}

/// Validates proposed occurrences against active restrictions.
/// Admins bypass all restrictions. Non-admin users are blocked unless
/// their user group is explicitly listed in `restriction_exemptions`.
pub async fn validate_occurrence_restrictions(
    pool: &PgPool,
    user_id: Uuid,
    is_admin: bool,
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    if is_admin || occurrences.is_empty() {
        return Ok(());
    }

    let user_group_id = sqlx::query_scalar!(
        r#"SELECT group_id FROM users WHERE id = $1 AND deleted_at IS NULL"#,
        user_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Käyttäjää ei löytynyt.".to_string()))?;

    for occ in occurrences {
        let violation = sqlx::query!(
            r#"
            SELECT r.title
            FROM restrictions r
            JOIN restriction_occurrences ro ON ro.restriction_id = r.id
            WHERE r.deleted_at IS NULL
              AND ro.start_time < $2
              AND ro.end_time > $1
              AND (ro.resource_id IS NULL OR ro.resource_id = $3)
              AND NOT EXISTS (
                  SELECT 1 
                  FROM restriction_exemptions re 
                  WHERE re.restriction_id = r.id AND re.group_id = $4
              )
            LIMIT 1
            "#,
            occ.start_time,
            occ.end_time,
            occ.resource_id,
            user_group_id
        )
        .fetch_optional(pool)
        .await?;

        if let Some(blocked) = violation {
            return Err(AppError::Forbidden(format!(
                "Varaus osuu rajoitetulle ajanjaksolle: '{}'",
                blocked.title
            )));
        }
    }

    Ok(())
}

/// Enforces `reservation_restricted` resources: non-admins may only reserve them when their
/// group is listed in `resource_groups`. Resources in `existing_resource_ids` (already on the
/// reservation being edited) are skipped, so revoking access never blocks edits to existing
/// reservations. Admins bypass this check.
pub async fn validate_resource_group_access(
    pool: &PgPool,
    user_id: Uuid,
    is_admin: bool,
    existing_resource_ids: &[Uuid],
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    if is_admin || occurrences.is_empty() {
        return Ok(());
    }

    let resource_ids: Vec<Uuid> = occurrences
        .iter()
        .map(|o| o.resource_id)
        .filter(|id| !existing_resource_ids.contains(id))
        .collect();
    if resource_ids.is_empty() {
        return Ok(());
    }

    let denied = sqlx::query_scalar!(
        r#"
        SELECT r.name
        FROM resources r
        JOIN users u ON u.id = $1 AND u.deleted_at IS NULL
        WHERE r.id = ANY($2)
          AND r.deleted_at IS NULL
          AND r.reservation_restricted = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM resource_groups rg
              WHERE rg.resource_id = r.id AND rg.group_id = u.group_id
          )
        ORDER BY r.name
        LIMIT 1
        "#,
        user_id,
        &resource_ids
    )
    .fetch_optional(pool)
    .await?;

    if let Some(name) = denied {
        return Err(AppError::Forbidden(format!(
            "Ryhmälläsi ei ole oikeutta varata resurssia '{name}'."
        )));
    }

    Ok(())
}

/// Whether a non-admin user's reservation of `resource_ids` may be confirmed immediately:
/// every resource must be `auto_confirm`, and where it lists auto-confirm groups the user's
/// group must be one of them. An empty resource list never auto-confirms.
pub async fn should_auto_confirm(
    pool: &PgPool,
    user_id: Uuid,
    resource_ids: &[Uuid],
) -> Result<bool, AppError> {
    if resource_ids.is_empty() {
        return Ok(false);
    }

    let blocking = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM resources r
        LEFT JOIN users u ON u.id = $1 AND u.deleted_at IS NULL
        WHERE r.id = ANY($2)
          AND (
              r.deleted_at IS NOT NULL
              OR r.auto_confirm = FALSE
              OR (
                  EXISTS (SELECT 1 FROM resource_auto_confirm_groups ag WHERE ag.resource_id = r.id)
                  AND NOT EXISTS (
                      SELECT 1 FROM resource_auto_confirm_groups ag
                      WHERE ag.resource_id = r.id AND ag.group_id = u.group_id
                  )
              )
          )
        "#,
        user_id,
        resource_ids
    )
    .fetch_one(pool)
    .await?;

    Ok(blocking == 0)
}

/// Validates each occurrence's length against the resource's min/max duration.
/// Admins bypass this check.
pub async fn validate_resource_durations(
    pool: &PgPool,
    is_admin: bool,
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    if is_admin || occurrences.is_empty() {
        return Ok(());
    }

    for occ in occurrences {
        let limits = sqlx::query!(
            r#"
            SELECT name, min_duration_minutes, max_duration_minutes
            FROM resources
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            occ.resource_id
        )
        .fetch_optional(pool)
        .await?;

        let Some(res) = limits else { continue };
        let minutes = (occ.end_time - occ.start_time).num_minutes();

        if let Some(min) = res.min_duration_minutes
            && minutes < i64::from(min)
        {
            return Err(AppError::BadRequest(format!(
                "Resurssin '{}' varauksen vähimmäiskesto on {}.",
                res.name,
                format_duration(min)
            )));
        }
        if let Some(max) = res.max_duration_minutes
            && minutes > i64::from(max)
        {
            return Err(AppError::BadRequest(format!(
                "Resurssin '{}' varauksen enimmäiskesto on {}.",
                res.name,
                format_duration(max)
            )));
        }
    }

    Ok(())
}

/// Formats minutes as e.g. "1 h 30 min" for error messages
fn format_duration(minutes: i32) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => format!("{m} min"),
        (h, 0) => format!("{h} h"),
        (h, m) => format!("{h} h {m} min"),
    }
}

/// Validates proposed occurrences against the resource's `reservable_until` boundary.
/// Admins bypass this check.
pub async fn validate_resource_reservable_until(
    pool: &PgPool,
    is_admin: bool,
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    if is_admin || occurrences.is_empty() {
        return Ok(());
    }

    for occ in occurrences {
        let resource_limit = sqlx::query!(
            r#"
            SELECT name, reservable_until
            FROM resources
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            occ.resource_id
        )
        .fetch_optional(pool)
        .await?;

        if let Some(res) = resource_limit {
            if let Some(until) = res.reservable_until {
                if occ.end_time > until {
                    return Err(AppError::BadRequest(format!(
                        "Resurssia '{}' voi varata vain kuupäivään {} asti.",
                        res.name,
                        until.format("%d.%m.%Y")
                    )));
                }
            }
        }
    }

    Ok(())
}

/// Enforces `blocks_only` resources: every occurrence on such a resource must match a
/// reservable block exactly (resource, start and end) and must not overlap another
/// confirmed or pending reservation. Callers skip this for admins.
///
/// Runs inside the caller's transaction and locks the affected resource rows, so two
/// concurrent requests cannot both book the same block.
pub async fn validate_block_only_occurrences(
    conn: &mut sqlx::PgConnection,
    exclude_reservation_id: Option<Uuid>,
    rrule: Option<&str>,
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    if occurrences.is_empty() {
        return Ok(());
    }

    let resource_ids: Vec<Uuid> = occurrences.iter().map(|o| o.resource_id).collect();
    let blocks_only_ids = sqlx::query_scalar!(
        r#"
        SELECT id FROM resources
        WHERE id = ANY($1) AND blocks_only = TRUE AND deleted_at IS NULL
        ORDER BY id
        FOR UPDATE
        "#,
        &resource_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    if blocks_only_ids.is_empty() {
        return Ok(());
    }

    if rrule.is_some() {
        return Err(AppError::Forbidden(
            "Toistuvia varauksia ei voi tehdä resurssille, jonka voi varata vain varausjaksoissa."
                .to_string(),
        ));
    }

    for resource_id in &blocks_only_ids {
        if occurrences
            .iter()
            .filter(|o| o.resource_id == *resource_id)
            .count()
            > 1
        {
            return Err(AppError::BadRequest(
                "Resurssille voi valita vain yhden varausjakson kerrallaan.".to_string(),
            ));
        }
    }

    for occ in occurrences
        .iter()
        .filter(|o| blocks_only_ids.contains(&o.resource_id))
    {
        let in_block = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM reservable_block_occurrences bo
                JOIN reservable_blocks b ON b.id = bo.block_id
                WHERE b.deleted_at IS NULL
                  AND bo.resource_id = $1
                  AND bo.start_time = $2
                  AND bo.end_time = $3
            ) AS "exists!"
            "#,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .fetch_one(&mut *conn)
        .await?;

        if !in_block {
            return Err(AppError::Forbidden(
                "Resurssin voi varata vain määritellyissä varausjaksoissa.".to_string(),
            ));
        }

        let taken = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM occurrences o
                JOIN reservations r ON r.id = o.reservation_id
                WHERE o.resource_id = $1
                  AND r.deleted_at IS NULL
                  AND r.status IN ('confirmed', 'pending')
                  AND ($4::uuid IS NULL OR r.id <> $4)
                  AND o.start_time < $3
                  AND o.end_time > $2
            ) AS "exists!"
            "#,
            occ.resource_id,
            occ.start_time,
            occ.end_time,
            exclude_reservation_id
        )
        .fetch_one(&mut *conn)
        .await?;

        if taken {
            return Err(AppError::Conflict("Varausjakso on jo varattu.".to_string()));
        }
    }

    Ok(())
}

pub async fn batch_import(
    pool: &PgPool,
    fallback_admin_id: Uuid,
    items: Vec<PortableReservationImport>,
) -> Result<BatchImportReport, AppError> {
    let mut tx = pool.begin().await?;

    // 1. Pre-fetch resource map (name -> UUID)
    let resources = sqlx::query!(r#"SELECT id, name FROM resources WHERE deleted_at IS NULL"#)
        .fetch_all(&mut *tx)
        .await?;

    let resource_map: HashMap<String, Uuid> = resources
        .into_iter()
        .map(|r| (r.name.to_lowercase(), r.id))
        .collect();

    // 2. Pre-fetch user map (email -> UUID)
    let users = sqlx::query!(r#"SELECT id, email FROM users WHERE deleted_at IS NULL"#)
        .fetch_all(&mut *tx)
        .await?;

    let user_map: HashMap<String, Uuid> = users
        .into_iter()
        .map(|u| (u.email.to_lowercase(), u.id))
        .collect();

    let mut created_ids = Vec::with_capacity(items.len());

    for (idx, item) in items.into_iter().enumerate() {
        let line = idx + 1;

        // Resolve user ID via email or default to current admin
        let user_id = match item.user_email.as_ref() {
            Some(email) => *user_map
                .get(&email.to_lowercase())
                .unwrap_or(&fallback_admin_id),
            None => fallback_admin_id,
        };

        let status = item.status.unwrap_or(ReservationStatus::Confirmed);

        // Create reservation
        let res_id = sqlx::query_scalar!(
            r#"
            INSERT INTO reservations (
                user_id, title, description, admin_notes,
                contact_person, contact_email, contact_phone,
                rrule, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            "#,
            user_id,
            item.title,
            item.description,
            item.admin_notes,
            item.contact_person,
            item.contact_email,
            item.contact_phone,
            item.rrule,
            status as ReservationStatus
        )
        .fetch_one(&mut *tx)
        .await?;

        // Insert occurrences
        for occ in item.occurrences {
            let resource_id = resource_map
                .get(&occ.resource_name.to_lowercase())
                .ok_or_else(|| {
                    AppError::BadRequest(format!(
                        "Rivi {line}: Resurssia '{}' ei löytynyt järjestelmästä.",
                        occ.resource_name
                    ))
                })?;

            sqlx::query!(
                r#"
                INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
                VALUES ($1, $2, $3, $4)
                "#,
                res_id,
                *resource_id,
                occ.start_time,
                occ.end_time
            )
            .execute(&mut *tx)
            .await?;
        }

        created_ids.push(res_id);
    }

    tx.commit().await?;

    Ok(BatchImportReport {
        imported_count: created_ids.len(),
        reservation_ids: created_ids,
    })
}
