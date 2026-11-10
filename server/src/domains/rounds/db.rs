use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use super::{
    allocation,
    models::{
        Allocation, AllocationProposal, CompleteRoundReport, CreateRoundPayload, Round,
        RoundApplication, RoundPhase, RoundStatus, UpdateRoundPayload,
    },
};
use crate::{
    domains::reservations::models::{CreateOccurrencePayload, ReservationStatus},
    errors::AppError,
};

struct RoundRow {
    id: Uuid,
    name: String,
    description: Option<String>,
    applications_open_at: DateTime<Utc>,
    applications_close_at: DateTime<Utc>,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
    max_pending_per_resource: i32,
    status: RoundStatus,
    completed_at: Option<DateTime<Utc>>,
    allocation_saved_at: Option<DateTime<Utc>>,
    resource_ids: Vec<Uuid>,
    group_ids: Vec<Uuid>,
    created_at: DateTime<Utc>,
}

impl From<RoundRow> for Round {
    fn from(r: RoundRow) -> Self {
        Round {
            phase: RoundPhase::derive(
                r.status,
                r.applications_open_at,
                r.applications_close_at,
                Utc::now(),
            ),
            id: r.id,
            name: r.name,
            description: r.description,
            applications_open_at: r.applications_open_at,
            applications_close_at: r.applications_close_at,
            period_start: r.period_start,
            period_end: r.period_end,
            max_pending_per_resource: r.max_pending_per_resource,
            status: r.status,
            completed_at: r.completed_at,
            allocation_saved_at: r.allocation_saved_at,
            resource_ids: r.resource_ids,
            group_ids: r.group_ids,
            created_at: r.created_at,
        }
    }
}

pub async fn list(pool: &PgPool) -> Result<Vec<Round>, AppError> {
    let rows = sqlx::query_as!(
        RoundRow,
        r#"
        SELECT r.id, r.name, r.description, r.applications_open_at, r.applications_close_at,
               r.period_start, r.period_end, r.max_pending_per_resource,
               r.status AS "status: RoundStatus", r.completed_at, r.allocation_saved_at,
               ARRAY(SELECT resource_id FROM reservation_round_resources WHERE round_id = r.id ORDER BY resource_id) AS "resource_ids!",
               ARRAY(SELECT group_id FROM reservation_round_groups WHERE round_id = r.id ORDER BY group_id) AS "group_ids!",
               r.created_at
        FROM reservation_rounds r
        WHERE r.deleted_at IS NULL
        ORDER BY r.applications_open_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Round::from).collect())
}

/// Active rounds the group may still apply to (upcoming or open).
pub async fn list_open_for_group(pool: &PgPool, group_id: Uuid) -> Result<Vec<Round>, AppError> {
    let rows = sqlx::query_as!(
        RoundRow,
        r#"
        SELECT r.id, r.name, r.description, r.applications_open_at, r.applications_close_at,
               r.period_start, r.period_end, r.max_pending_per_resource,
               r.status AS "status: RoundStatus", r.completed_at, r.allocation_saved_at,
               ARRAY(SELECT resource_id FROM reservation_round_resources WHERE round_id = r.id ORDER BY resource_id) AS "resource_ids!",
               ARRAY(SELECT group_id FROM reservation_round_groups WHERE round_id = r.id ORDER BY group_id) AS "group_ids!",
               r.created_at
        FROM reservation_rounds r
        WHERE r.deleted_at IS NULL
          AND r.status = 'active'
          AND r.applications_close_at > NOW()
          AND EXISTS (SELECT 1 FROM reservation_round_groups g WHERE g.round_id = r.id AND g.group_id = $1)
        ORDER BY r.applications_open_at
        "#,
        group_id
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Round::from).collect())
}

pub async fn find(pool: &PgPool, id: Uuid) -> Result<Round, AppError> {
    let row = sqlx::query_as!(
        RoundRow,
        r#"
        SELECT r.id, r.name, r.description, r.applications_open_at, r.applications_close_at,
               r.period_start, r.period_end, r.max_pending_per_resource,
               r.status AS "status: RoundStatus", r.completed_at, r.allocation_saved_at,
               ARRAY(SELECT resource_id FROM reservation_round_resources WHERE round_id = r.id ORDER BY resource_id) AS "resource_ids!",
               ARRAY(SELECT group_id FROM reservation_round_groups WHERE round_id = r.id ORDER BY group_id) AS "group_ids!",
               r.created_at
        FROM reservation_rounds r
        WHERE r.deleted_at IS NULL AND r.id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(row.into())
}

/// Resources must be `blocks_only`, and no other round may accept applications for the same
/// resource at the same time. Locks the resource rows so concurrent changes serialize.
async fn validate_scope(
    conn: &mut PgConnection,
    exclude_round_id: Option<Uuid>,
    resource_ids: &[Uuid],
    open_at: DateTime<Utc>,
    close_at: DateTime<Utc>,
) -> Result<(), AppError> {
    let blocks_only = sqlx::query_scalar!(
        r#"
        SELECT id FROM resources
        WHERE id = ANY($1) AND blocks_only = TRUE AND deleted_at IS NULL
        ORDER BY id
        FOR UPDATE
        "#,
        resource_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    if blocks_only.len() != resource_ids.iter().collect::<HashSet<_>>().len() {
        return Err(AppError::BadRequest(
            "Varauskierroksen resurssien tulee olla varattavissa vain varausjaksoissa.".to_string(),
        ));
    }

    let overlapping = sqlx::query_scalar!(
        r#"
        SELECT r.name
        FROM reservation_rounds r
        JOIN reservation_round_resources x ON x.round_id = r.id
        WHERE r.deleted_at IS NULL
          AND x.resource_id = ANY($1)
          AND ($2::uuid IS NULL OR r.id <> $2)
          AND r.applications_open_at < $4
          AND r.applications_close_at > $3
        LIMIT 1
        "#,
        resource_ids,
        exclude_round_id,
        open_at,
        close_at
    )
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(name) = overlapping {
        return Err(AppError::Conflict(format!(
            "Kierroksen '{name}' hakuaika on päällekkäinen samojen resurssien kanssa."
        )));
    }
    Ok(())
}

async fn check_groups_exist(conn: &mut PgConnection, group_ids: &[Uuid]) -> Result<(), AppError> {
    let found = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM groups WHERE id = ANY($1) AND deleted_at IS NULL"#,
        group_ids
    )
    .fetch_one(&mut *conn)
    .await?;
    if found as usize != group_ids.iter().collect::<HashSet<_>>().len() {
        return Err(AppError::BadRequest("Tuntematon ryhmä.".to_string()));
    }
    Ok(())
}

pub async fn create(pool: &PgPool, dto: CreateRoundPayload) -> Result<Round, AppError> {
    if dto.applications_open_at >= dto.applications_close_at {
        return Err(AppError::BadRequest(
            "Hakuajan alun tulee olla ennen loppua.".to_string(),
        ));
    }
    if dto.period_start >= dto.period_end {
        return Err(AppError::BadRequest(
            "Kierroksen ajanjakson alun tulee olla ennen loppua.".to_string(),
        ));
    }

    let mut tx = pool.begin().await?;
    validate_scope(
        &mut tx,
        None,
        &dto.resource_ids,
        dto.applications_open_at,
        dto.applications_close_at,
    )
    .await?;
    check_groups_exist(&mut tx, &dto.group_ids).await?;

    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO reservation_rounds (
            name, description, applications_open_at, applications_close_at,
            period_start, period_end, max_pending_per_resource
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
        dto.name,
        dto.description,
        dto.applications_open_at,
        dto.applications_close_at,
        dto.period_start,
        dto.period_end,
        dto.max_pending_per_resource
    )
    .fetch_one(&mut *tx)
    .await?;

    set_resources(&mut tx, id, &dto.resource_ids).await?;
    set_groups(&mut tx, id, &dto.group_ids).await?;
    tx.commit().await?;

    find(pool, id).await
}

async fn set_resources(
    conn: &mut PgConnection,
    round_id: Uuid,
    resource_ids: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM reservation_round_resources WHERE round_id = $1",
        round_id
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
        INSERT INTO reservation_round_resources (round_id, resource_id)
        SELECT $1, UNNEST($2::uuid[])
        ON CONFLICT DO NOTHING
        "#,
        round_id,
        resource_ids
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

async fn set_groups(
    conn: &mut PgConnection,
    round_id: Uuid,
    group_ids: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM reservation_round_groups WHERE round_id = $1",
        round_id
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
        INSERT INTO reservation_round_groups (round_id, group_id)
        SELECT $1, UNNEST($2::uuid[])
        ON CONFLICT DO NOTHING
        "#,
        round_id,
        group_ids
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Before the window opens everything can change. Afterwards only the name, description and
/// closing time (e.g. to extend the window) can, and groups may be added.
pub async fn update(pool: &PgPool, id: Uuid, dto: UpdateRoundPayload) -> Result<Round, AppError> {
    let mut tx = pool.begin().await?;

    let current = sqlx::query!(
        r#"SELECT status AS "status: RoundStatus", applications_open_at, applications_close_at
           FROM reservation_rounds WHERE id = $1 AND deleted_at IS NULL FOR UPDATE"#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if current.status == RoundStatus::Completed {
        return Err(AppError::Conflict(
            "Päättynyttä kierrosta ei voi muokata.".to_string(),
        ));
    }

    let started = Utc::now() >= current.applications_open_at;
    if started
        && (dto.applications_open_at.is_some()
            || dto.period_start.is_some()
            || dto.period_end.is_some()
            || dto.max_pending_per_resource.is_some()
            || dto.resource_ids.is_some()
            || dto.group_ids.is_some())
    {
        return Err(AppError::Conflict(
            "Alkanutta kierrosta voi muokata vain nimeä, kuvausta ja hakuajan loppua.".to_string(),
        ));
    }

    let open_at = dto
        .applications_open_at
        .unwrap_or(current.applications_open_at);
    let close_at = dto
        .applications_close_at
        .unwrap_or(current.applications_close_at);
    if open_at >= close_at {
        return Err(AppError::BadRequest(
            "Hakuajan alun tulee olla ennen loppua.".to_string(),
        ));
    }

    let resource_ids = match &dto.resource_ids {
        Some(ids) => ids.clone(),
        None => {
            sqlx::query_scalar!(
                "SELECT resource_id FROM reservation_round_resources WHERE round_id = $1",
                id
            )
            .fetch_all(&mut *tx)
            .await?
        }
    };
    validate_scope(&mut tx, Some(id), &resource_ids, open_at, close_at).await?;

    if let Some(group_ids) = &dto.group_ids {
        check_groups_exist(&mut tx, group_ids).await?;
        set_groups(&mut tx, id, group_ids).await?;
    }
    if dto.resource_ids.is_some() {
        set_resources(&mut tx, id, &resource_ids).await?;
    }

    sqlx::query!(
        r#"
        UPDATE reservation_rounds
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            applications_open_at = $4,
            applications_close_at = $5,
            period_start = COALESCE($6, period_start),
            period_end = COALESCE($7, period_end),
            max_pending_per_resource = COALESCE($8, max_pending_per_resource),
            updated_at = NOW()
        WHERE id = $1
        "#,
        id,
        dto.name,
        dto.description,
        open_at,
        close_at,
        dto.period_start,
        dto.period_end,
        dto.max_pending_per_resource
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref d) if d.constraint() == Some("rounds_period_order") => {
            AppError::BadRequest("Kierroksen ajanjakson alun tulee olla ennen loppua.".to_string())
        }
        other => other.into(),
    })?;

    tx.commit().await?;
    find(pool, id).await
}

/// Only rounds without applications can be deleted.
pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let used = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM reservations WHERE round_id = $1 AND deleted_at IS NULL) AS "used!""#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;
    if used {
        return Err(AppError::Conflict(
            "Kierroksella on hakemuksia, joten sitä ei voi poistaa.".to_string(),
        ));
    }
    let result = sqlx::query!(
        "UPDATE reservation_rounds SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
        id
    )
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(())
}

/// Rejects a normal (non-round) booking of a resource during a round that covers it and has not
/// been completed. Once the round is completed the normal rules apply again.
pub async fn ensure_not_under_round(
    conn: &mut PgConnection,
    occurrences: &[CreateOccurrencePayload],
) -> Result<(), AppError> {
    for occ in occurrences {
        let round = sqlx::query_scalar!(
            r#"
            SELECT r.name
            FROM reservation_rounds r
            JOIN reservation_round_resources x ON x.round_id = r.id
            WHERE r.deleted_at IS NULL
              AND r.status = 'active'
              AND x.resource_id = $1
              AND r.period_start < $3
              AND r.period_end > $2
            LIMIT 1
            "#,
            occ.resource_id,
            occ.start_time,
            occ.end_time
        )
        .fetch_optional(&mut *conn)
        .await?;
        if let Some(name) = round {
            return Err(AppError::Forbidden(format!(
                "Resurssille on käynnissä varauskierros '{name}'. Varausjakso on haettavissa vain kierroksen kautta."
            )));
        }
    }
    Ok(())
}

/// Validates an application against its round inside the caller's transaction and returns the
/// priority for it (last in the applicant's list). Locks the round row.
pub async fn prepare_application(
    conn: &mut PgConnection,
    round_id: Uuid,
    owner_id: Uuid,
    is_admin: bool,
    occurrences: &[CreateOccurrencePayload],
) -> Result<i32, AppError> {
    let [occ] = occurrences else {
        return Err(AppError::BadRequest(
            "Kierroshakemuksessa on oltava täsmälleen yksi varausjakso.".to_string(),
        ));
    };

    let round = sqlx::query!(
        r#"
        SELECT status AS "status: RoundStatus", applications_open_at, applications_close_at,
               period_start, period_end, max_pending_per_resource
        FROM reservation_rounds
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
        "#,
        round_id
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    let now = Utc::now();
    if round.status == RoundStatus::Completed {
        return Err(AppError::Conflict(
            "Varauskierros on päättynyt.".to_string(),
        ));
    }
    if !is_admin && !(round.applications_open_at <= now && now < round.applications_close_at) {
        return Err(AppError::Forbidden(
            "Varauskierroksen hakuaika ei ole käynnissä.".to_string(),
        ));
    }

    let group_ok = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM users u
            JOIN reservation_round_groups g ON g.group_id = u.group_id
            WHERE u.id = $1 AND g.round_id = $2
        ) AS "ok!"
        "#,
        owner_id,
        round_id
    )
    .fetch_one(&mut *conn)
    .await?;
    if !group_ok {
        return Err(AppError::Forbidden(
            "Ryhmäsi ei voi hakea tässä varauskierroksessa.".to_string(),
        ));
    }

    let resource_ok = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM reservation_round_resources WHERE round_id = $1 AND resource_id = $2) AS "ok!""#,
        round_id,
        occ.resource_id
    )
    .fetch_one(&mut *conn)
    .await?;
    if !resource_ok {
        return Err(AppError::BadRequest(
            "Resurssi ei kuulu tähän varauskierrokseen.".to_string(),
        ));
    }

    if occ.start_time < round.period_start || occ.end_time > round.period_end {
        return Err(AppError::BadRequest(
            "Varausjakso on varauskierroksen ajanjakson ulkopuolella.".to_string(),
        ));
    }

    let existing = sqlx::query!(
        r#"
        SELECT COUNT(*) AS "count!",
               COALESCE(MAX(r.round_priority), 0) AS "max_priority!",
               COALESCE(BOOL_OR(o.start_time = $4), FALSE) AS "same_slot!"
        FROM reservations r
        JOIN occurrences o ON o.reservation_id = r.id
        WHERE r.round_id = $1 AND r.user_id = $2 AND o.resource_id = $3
          AND r.deleted_at IS NULL AND r.status = 'pending'
        "#,
        round_id,
        owner_id,
        occ.resource_id,
        occ.start_time
    )
    .fetch_one(&mut *conn)
    .await?;

    if existing.same_slot {
        return Err(AppError::Conflict(
            "Olet jo hakenut tätä varausjaksoa.".to_string(),
        ));
    }
    if existing.count >= i64::from(round.max_pending_per_resource) {
        return Err(AppError::Conflict(format!(
            "Voit hakea resurssille enintään {} varausjaksoa tällä kierroksella.",
            round.max_pending_per_resource
        )));
    }

    Ok(existing.max_priority + 1)
}

/// Locks the round and checks that the applicant's window is open (for the owner's own changes).
pub async fn ensure_window_open(pool: &PgPool, round_id: Uuid) -> Result<(), AppError> {
    let round = find(pool, round_id).await?;
    if round.phase != RoundPhase::Open {
        return Err(AppError::Forbidden(
            "Hakemuksia voi muuttaa vain hakuajan aikana.".to_string(),
        ));
    }
    Ok(())
}

pub async fn set_priorities(
    pool: &PgPool,
    round_id: Uuid,
    user_id: Uuid,
    resource_id: Uuid,
    ordered: &[Uuid],
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let round = sqlx::query!(
        r#"SELECT status AS "status: RoundStatus", applications_open_at, applications_close_at
           FROM reservation_rounds WHERE id = $1 AND deleted_at IS NULL FOR UPDATE"#,
        round_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let phase = RoundPhase::derive(
        round.status,
        round.applications_open_at,
        round.applications_close_at,
        Utc::now(),
    );
    if phase != RoundPhase::Open {
        return Err(AppError::Forbidden(
            "Prioriteetteja voi muuttaa vain hakuajan aikana.".to_string(),
        ));
    }

    let mut mine = sqlx::query_scalar!(
        r#"
        SELECT r.id
        FROM reservations r
        JOIN occurrences o ON o.reservation_id = r.id
        WHERE r.round_id = $1 AND r.user_id = $2 AND o.resource_id = $3
          AND r.deleted_at IS NULL AND r.status = 'pending'
        "#,
        round_id,
        user_id,
        resource_id
    )
    .fetch_all(&mut *tx)
    .await?;
    mine.sort();
    let mut given = ordered.to_vec();
    given.sort();
    if mine != given {
        return Err(AppError::BadRequest(
            "Lista ei vastaa hakemuksiasi tälle resurssille.".to_string(),
        ));
    }

    for (i, reservation_id) in ordered.iter().enumerate() {
        sqlx::query!(
            "UPDATE reservations SET round_priority = $2, updated_at = NOW() WHERE id = $1",
            reservation_id,
            i as i32 + 1
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn list_applications(
    conn: &mut PgConnection,
    round_id: Uuid,
    pending_only: bool,
) -> Result<Vec<RoundApplication>, AppError> {
    Ok(sqlx::query_as!(
        RoundApplication,
        r#"
        SELECT r.id AS reservation_id,
               r.user_id,
               u.name AS "user_name?",
               u.email AS "user_email?",
               r.title,
               r.description_rich AS description,
               r.message_to_admins,
               r.admin_notes,
               r.contact_person,
               r.contact_email,
               r.contact_phone,
               r.status AS "status: ReservationStatus",
               o.resource_id,
               o.start_time,
               o.end_time,
               COALESCE(r.round_priority, 1) AS "priority!",
               EXISTS (
                   SELECT 1
                   FROM occurrences o2
                   JOIN reservations r2 ON r2.id = o2.reservation_id
                   WHERE o2.resource_id = o.resource_id
                     AND o2.start_time = o.start_time
                     AND r2.deleted_at IS NULL
                     AND r2.status IN ('confirmed', 'pending')
                     AND r2.round_id IS DISTINCT FROM r.round_id
               ) AS "externally_taken!"
        FROM reservations r
        JOIN occurrences o ON o.reservation_id = r.id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.round_id = $1 AND r.deleted_at IS NULL
          AND ($2 = FALSE OR r.status = 'pending')
        ORDER BY o.resource_id, o.start_time, r.created_at
        "#,
        round_id,
        pending_only
    )
    .fetch_all(&mut *conn)
    .await?)
}

/// Slots (resource, start) on the round's resources that are already taken by something other
/// than this round's applications.
async fn unavailable_slots(
    conn: &mut PgConnection,
    round_id: Uuid,
) -> Result<HashSet<(Uuid, DateTime<Utc>)>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT o.resource_id, o.start_time
        FROM occurrences o
        JOIN reservations r ON r.id = o.reservation_id
        WHERE r.deleted_at IS NULL
          AND r.status IN ('confirmed', 'pending')
          AND r.round_id IS DISTINCT FROM $1
          AND o.resource_id IN (SELECT resource_id FROM reservation_round_resources WHERE round_id = $1)
        "#,
        round_id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.resource_id, r.start_time))
        .collect())
}

fn ensure_allocating(round: &Round) -> Result<(), AppError> {
    if round.phase != RoundPhase::Allocating {
        return Err(AppError::Conflict(
            "Jako voidaan tehdä vasta hakuajan päätyttyä ja ennen kierroksen päättämistä."
                .to_string(),
        ));
    }
    Ok(())
}

pub async fn propose_allocation(
    pool: &PgPool,
    round_id: Uuid,
    seed: Option<u64>,
) -> Result<AllocationProposal, AppError> {
    let round = find(pool, round_id).await?;
    ensure_allocating(&round)?;
    let mut conn = pool.acquire().await?;
    let applications = list_applications(&mut conn, round_id, true).await?;
    let unavailable = unavailable_slots(&mut conn, round_id).await?;
    let seed = seed.unwrap_or_else(|| Uuid::new_v4().as_u128() as u64);
    Ok(AllocationProposal {
        seed,
        reservation_ids: allocation::allocate(&applications, &unavailable, seed),
    })
}

pub async fn get_allocation(pool: &PgPool, round_id: Uuid) -> Result<Allocation, AppError> {
    let round = find(pool, round_id).await?;
    let reservation_ids = sqlx::query_scalar!(
        "SELECT reservation_id FROM reservation_round_allocations WHERE round_id = $1",
        round_id
    )
    .fetch_all(pool)
    .await?;
    Ok(Allocation {
        saved: round.allocation_saved_at.is_some(),
        reservation_ids,
    })
}

/// A grant list is valid when it only names pending applications of the round, gives no slot
/// twice, stays within the per-user limit and avoids slots taken elsewhere.
async fn validate_grants(
    conn: &mut PgConnection,
    round: &Round,
    grants: &[Uuid],
) -> Result<(), AppError> {
    let applications = list_applications(&mut *conn, round.id, true).await?;
    let by_id: HashMap<Uuid, &RoundApplication> =
        applications.iter().map(|a| (a.reservation_id, a)).collect();
    let unavailable = unavailable_slots(conn, round.id).await?;

    let mut slots = HashSet::new();
    let mut per_user: HashMap<(Uuid, Uuid), i32> = HashMap::new();
    for id in grants {
        let app = by_id.get(id).ok_or_else(|| {
            AppError::BadRequest("Jako sisältää hakemuksen, joka ei kuulu kierrokseen.".to_string())
        })?;
        let slot = (app.resource_id, app.start_time);
        if unavailable.contains(&slot) {
            return Err(AppError::Conflict(
                "Jako sisältää varausjakson, joka on jo varattu.".to_string(),
            ));
        }
        if !slots.insert(slot) {
            return Err(AppError::Conflict(
                "Sama varausjakso on annettu useammalle hakijalle.".to_string(),
            ));
        }
        let count = per_user.entry((app.user_id, app.resource_id)).or_insert(0);
        *count += 1;
        if *count > round.max_pending_per_resource {
            return Err(AppError::Conflict(
                "Jako ylittää hakijan enimmäismäärän resurssia kohden.".to_string(),
            ));
        }
    }
    Ok(())
}

pub async fn save_allocation(
    pool: &PgPool,
    round_id: Uuid,
    grants: &[Uuid],
) -> Result<Allocation, AppError> {
    let mut tx = pool.begin().await?;
    lock_round(&mut tx, round_id).await?;
    let round = find(pool, round_id).await?;
    ensure_allocating(&round)?;
    validate_grants(&mut tx, &round, grants).await?;

    sqlx::query!(
        "DELETE FROM reservation_round_allocations WHERE round_id = $1",
        round_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
        INSERT INTO reservation_round_allocations (round_id, reservation_id)
        SELECT $1, UNNEST($2::uuid[])
        "#,
        round_id,
        grants
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE reservation_rounds SET allocation_saved_at = NOW() WHERE id = $1",
        round_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    get_allocation(pool, round_id).await
}

async fn lock_round(conn: &mut PgConnection, round_id: Uuid) -> Result<(), AppError> {
    sqlx::query_scalar!(
        "SELECT id FROM reservation_rounds WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
        round_id
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(())
}

/// Result of completing a round: the reservations to notify.
pub struct Completion {
    pub report: CompleteRoundReport,
    pub confirmed: Vec<Uuid>,
    pub cancelled: Vec<Uuid>,
}

/// Applies the saved allocation: granted applications become confirmed, the rest are cancelled,
/// and the round is closed so normal booking rules apply again. All in one transaction.
pub async fn complete(
    pool: &PgPool,
    round_id: Uuid,
    admin_id: Uuid,
) -> Result<Completion, AppError> {
    let mut tx = pool.begin().await?;
    lock_round(&mut tx, round_id).await?;
    let round = find(pool, round_id).await?;
    ensure_allocating(&round)?;
    if round.allocation_saved_at.is_none() {
        return Err(AppError::Conflict(
            "Tallenna jako ennen kierroksen päättämistä.".to_string(),
        ));
    }

    let grants = sqlx::query_scalar!(
        "SELECT reservation_id FROM reservation_round_allocations WHERE round_id = $1",
        round_id
    )
    .fetch_all(&mut *tx)
    .await?;
    validate_grants(&mut tx, &round, &grants).await?;

    let confirmed = sqlx::query_scalar!(
        r#"
        UPDATE reservations
        SET status = 'confirmed', updated_at = NOW()
        WHERE id = ANY($1) AND round_id = $2 AND status = 'pending'
        RETURNING id
        "#,
        &grants,
        round_id
    )
    .fetch_all(&mut *tx)
    .await?;

    let cancelled = sqlx::query_scalar!(
        r#"
        UPDATE reservations
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = $2,
            cancel_reason = 'Varausta ei myönnetty varauskierroksella.',
            updated_at = NOW()
        WHERE round_id = $1 AND status = 'pending' AND deleted_at IS NULL
        RETURNING id
        "#,
        round_id,
        admin_id
    )
    .fetch_all(&mut *tx)
    .await?;

    sqlx::query!(
        "UPDATE reservation_rounds SET status = 'completed', completed_at = NOW(), completed_by = $2, updated_at = NOW() WHERE id = $1",
        round_id,
        admin_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Completion {
        report: CompleteRoundReport {
            confirmed_count: confirmed.len(),
            cancelled_count: cancelled.len(),
        },
        confirmed,
        cancelled,
    })
}
