//! Turns a parsed Outlook invite into a confirmed Kuutar reservation.
//!
//! Outlook is the source of truth, so imports skip conflict, restriction, block and group-access
//! checks and are always confirmed.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::ical::{Method, ParsedInvite};
use crate::errors::AppError;

/// How far ahead recurring invites are expanded.
const HORIZON_DAYS: i64 = 730;

#[derive(Debug, PartialEq, Eq)]
pub enum ImportOutcome {
    Imported(Uuid),
    Updated(Uuid),
    Cancelled(Uuid),
    Ignored(String),
}

impl ImportOutcome {
    pub fn result(&self) -> &'static str {
        match self {
            Self::Imported(_) => "imported",
            Self::Updated(_) => "updated",
            Self::Cancelled(_) => "cancelled",
            Self::Ignored(_) => "ignored",
        }
    }

    pub fn reservation_id(&self) -> Option<Uuid> {
        match self {
            Self::Imported(id) | Self::Updated(id) | Self::Cancelled(id) => Some(*id),
            Self::Ignored(_) => None,
        }
    }

    pub fn detail(&self) -> Option<&str> {
        match self {
            Self::Ignored(reason) => Some(reason),
            _ => None,
        }
    }
}

/// Owner for events whose organizer is not a Kuutar user.
pub async fn resolve_fallback_user(pool: &PgPool, fallback_email: &str) -> Result<Uuid, AppError> {
    let by_email = sqlx::query_scalar!(
        r#"SELECT id FROM users WHERE email = LOWER($1) AND deleted_at IS NULL"#,
        fallback_email
    )
    .fetch_optional(pool)
    .await?;
    if let Some(id) = by_email {
        return Ok(id);
    }

    sqlx::query_scalar!(
        r#"
        SELECT id FROM users
        WHERE role = 'admin'::user_role AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 1
        "#
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::InternalServerError("No user to own imported events".to_string()))
}

pub async fn import_invite(
    pool: &PgPool,
    fallback_user_id: Uuid,
    invite: &ParsedInvite,
    now: DateTime<Utc>,
) -> Result<ImportOutcome, AppError> {
    if invite.is_override {
        return Ok(ImportOutcome::Ignored(
            "Changes to a single occurrence of a series are not supported yet".to_string(),
        ));
    }
    if let Method::Other(method) = &invite.method {
        return Ok(ImportOutcome::Ignored(format!(
            "Unsupported calendar method {method}"
        )));
    }

    let mut tx = pool.begin().await?;

    let existing = sqlx::query!(
        r#"
        SELECT id, ical_sequence, deleted_at, source
        FROM reservations
        WHERE ical_uid = $1
        FOR UPDATE
        "#,
        invite.uid
    )
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(row) = &existing {
        if row.deleted_at.is_some() {
            return Ok(ImportOutcome::Ignored(
                "The reservation was deleted in Kuutar".to_string(),
            ));
        }
        if row.source != "outlook" {
            // One of our own exports coming back around
            return Ok(ImportOutcome::Ignored(
                "The event originates from Kuutar".to_string(),
            ));
        }
        if row
            .ical_sequence
            .is_some_and(|stored| invite.sequence < stored)
            || (row.ical_sequence == Some(invite.sequence) && invite.method == Method::Request)
        {
            return Ok(ImportOutcome::Ignored(
                "Already up to date (older or repeated invite)".to_string(),
            ));
        }
    }

    if invite.method == Method::Cancel {
        let Some(row) = existing else {
            return Ok(ImportOutcome::Ignored(
                "Cancellation of an event Kuutar never imported".to_string(),
            ));
        };
        set_cancelled(&mut tx, row.id, invite.sequence).await?;
        tx.commit().await?;
        return Ok(ImportOutcome::Cancelled(row.id));
    }

    let resource_ids = match_resources(&mut tx, invite).await?;
    if resource_ids.is_empty() {
        return match existing {
            // The resources were removed from the invite: nothing is reserved any more
            Some(row) => {
                set_cancelled(&mut tx, row.id, invite.sequence).await?;
                tx.commit().await?;
                Ok(ImportOutcome::Cancelled(row.id))
            }
            None => Ok(ImportOutcome::Ignored(
                "No attendee or location matches a resource's Outlook address".to_string(),
            )),
        };
    }

    let owner = resolve_owner(&mut tx, invite, fallback_user_id).await?;
    let title: String = if invite.summary.trim().is_empty() {
        "Outlook".to_string()
    } else {
        invite.summary.trim().chars().take(255).collect()
    };
    let (contact_person, contact_email) = match &invite.organizer {
        Some(p) => (p.name.clone(), Some(p.email.clone())),
        None => (None, None),
    };

    let horizon = now + Duration::days(HORIZON_DAYS);
    let occurrences = invite.occurrences(horizon);

    let (reservation_id, created) = match existing {
        Some(row) => {
            sqlx::query!(
                r#"
                UPDATE reservations
                SET user_id = $1, title = $2, description = $3,
                    contact_person = $4, contact_email = $5, rrule = $6,
                    status = 'confirmed', ical_sequence = $7, updated_at = NOW()
                WHERE id = $8
                "#,
                owner,
                title,
                invite.description,
                contact_person,
                contact_email,
                invite.rrule,
                invite.sequence,
                row.id
            )
            .execute(&mut *tx)
            .await?;
            sqlx::query!(
                r#"DELETE FROM occurrences WHERE reservation_id = $1"#,
                row.id
            )
            .execute(&mut *tx)
            .await?;
            (row.id, false)
        }
        None => {
            let id = sqlx::query_scalar!(
                r#"
                INSERT INTO reservations (
                    user_id, title, description, contact_person, contact_email, rrule,
                    status, source, ical_uid, ical_sequence
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', 'outlook', $7, $8)
                RETURNING id
                "#,
                owner,
                title,
                invite.description,
                contact_person,
                contact_email,
                invite.rrule,
                invite.uid,
                invite.sequence
            )
            .fetch_one(&mut *tx)
            .await?;
            (id, true)
        }
    };

    for resource_id in &resource_ids {
        for (start, end) in &occurrences {
            sqlx::query!(
                r#"
                INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
                VALUES ($1, $2, $3, $4)
                "#,
                reservation_id,
                resource_id,
                start,
                end
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(if created {
        ImportOutcome::Imported(reservation_id)
    } else {
        ImportOutcome::Updated(reservation_id)
    })
}

async fn set_cancelled(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    sequence: i32,
) -> Result<(), AppError> {
    sqlx::query!(
        r#"
        UPDATE reservations
        SET status = 'cancelled', ical_sequence = $1, updated_at = NOW()
        WHERE id = $2
        "#,
        sequence,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Resources named by the invite: attendees whose address is a resource's Outlook mailbox,
/// else a LOCATION that names a resource or its mailbox.
async fn match_resources(
    tx: &mut Transaction<'_, Postgres>,
    invite: &ParsedInvite,
) -> Result<Vec<Uuid>, AppError> {
    let rows = sqlx::query!(
        r#"SELECT id, name, outlook_email AS "outlook_email!" FROM resources
           WHERE outlook_email IS NOT NULL AND deleted_at IS NULL"#
    )
    .fetch_all(&mut **tx)
    .await?;

    let by_email: HashMap<&str, Uuid> = rows
        .iter()
        .map(|r| (r.outlook_email.as_str(), r.id))
        .collect();

    let mut matched: Vec<Uuid> = Vec::new();
    for attendee in &invite.attendees {
        if let Some(id) = by_email.get(attendee.email.as_str())
            && !matched.contains(id)
        {
            matched.push(*id);
        }
    }

    if matched.is_empty()
        && let Some(location) = &invite.location
    {
        for part in location.split(';').map(|p| p.trim().to_lowercase()) {
            let hit = rows
                .iter()
                .find(|r| r.name.to_lowercase() == part || r.outlook_email == part);
            if let Some(r) = hit
                && !matched.contains(&r.id)
            {
                matched.push(r.id);
            }
        }
    }

    Ok(matched)
}

async fn resolve_owner(
    tx: &mut Transaction<'_, Postgres>,
    invite: &ParsedInvite,
    fallback_user_id: Uuid,
) -> Result<Uuid, AppError> {
    let Some(organizer) = &invite.organizer else {
        return Ok(fallback_user_id);
    };
    let id = sqlx::query_scalar!(
        r#"SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL"#,
        organizer.email
    )
    .fetch_optional(&mut **tx)
    .await?;
    Ok(id.unwrap_or(fallback_user_id))
}
