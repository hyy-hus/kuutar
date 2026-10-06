//! Polls the intake mailbox and feeds the invites to the importer.

use std::sync::Mutex;
use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use super::{
    graph::{GraphClient, InboxMessage, OutlookClient},
    ical::{self, ParsedInvite},
    importer::{self, ImportOutcome},
    models::{SyncLogEntry, SyncRunReport, SyncStatus},
};
use crate::{config::Config, errors::AppError};

/// A message that keeps failing is given up on after this many attempts.
const MAX_ATTEMPTS: i32 = 5;

/// Arbitrary key for the Postgres advisory lock that keeps a single instance polling.
const LOCK_KEY: i64 = 0x4b55_5554_4f55_544c;

#[derive(Default)]
struct PollState {
    last_run_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
}

static STATE: Mutex<PollState> = Mutex::new(PollState {
    last_run_at: None,
    last_error: None,
});

fn record_run(error: Option<String>) {
    if let Ok(mut state) = STATE.lock() {
        state.last_run_at = Some(Utc::now());
        state.last_error = error;
    }
}

/// Starts the background loop; does nothing unless the Graph settings are complete.
pub fn spawn(pool: PgPool, config: Config) {
    if !config.outlook_enabled() {
        tracing::info!("Outlook sync disabled (GRAPH_* settings missing)");
        return;
    }
    let client = match GraphClient::from_config(&config) {
        Ok(client) => client,
        Err(err) => {
            tracing::error!("Outlook sync could not start: {err}");
            return;
        }
    };

    tokio::spawn(async move {
        let interval = Duration::from_secs(config.graph_poll_seconds.max(10));
        loop {
            if let Err(err) = run_cycle(&pool, &config, &client).await {
                tracing::error!("Outlook sync cycle failed: {err}");
            }
            tokio::time::sleep(interval).await;
        }
    });
}

/// One poll of the intake mailbox. Returns `None` when another instance holds the lock.
pub async fn run_cycle(
    pool: &PgPool,
    config: &Config,
    client: &dyn OutlookClient,
) -> Result<Option<SyncRunReport>, AppError> {
    // The advisory lock belongs to this connection and is released if the process dies
    let mut lock_conn = pool.acquire().await?;
    let locked = sqlx::query_scalar!("SELECT pg_try_advisory_lock($1)", LOCK_KEY)
        .fetch_one(&mut *lock_conn)
        .await?
        .unwrap_or(false);
    if !locked {
        return Ok(None);
    }

    let result = process_inbox(pool, config, client).await;

    if let Err(err) = sqlx::query!("SELECT pg_advisory_unlock($1)", LOCK_KEY)
        .fetch_one(&mut *lock_conn)
        .await
    {
        tracing::warn!("Could not release the Outlook sync lock: {err}");
    }

    record_run(result.as_ref().err().map(|e| e.to_string()));
    result.map(Some)
}

pub async fn process_inbox(
    pool: &PgPool,
    config: &Config,
    client: &dyn OutlookClient,
) -> Result<SyncRunReport, AppError> {
    let fallback_email = config
        .outlook_fallback_user_email
        .as_deref()
        .unwrap_or(&config.seed_admin_email);
    let fallback_user = importer::resolve_fallback_user(pool, fallback_email).await?;

    let messages = client
        .list_unread()
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let mut report = SyncRunReport {
        messages: messages.len(),
        ..Default::default()
    };

    for message in messages {
        let attempts = previous_attempts(pool, &message.id).await? + 1;

        match process_message(pool, client, fallback_user, &message).await {
            Ok((outcome, uid)) => {
                match outcome {
                    ImportOutcome::Imported(_) => report.imported += 1,
                    ImportOutcome::Updated(_) => report.updated += 1,
                    ImportOutcome::Cancelled(_) => report.cancelled += 1,
                    ImportOutcome::Ignored(_) => report.ignored += 1,
                }
                write_log(
                    pool,
                    &message,
                    uid.as_deref(),
                    outcome.result(),
                    outcome.detail(),
                    outcome.reservation_id(),
                    attempts,
                )
                .await?;
                if let Err(err) = client.mark_processed(&message.id).await {
                    tracing::warn!("Could not mark message {} processed: {err}", message.id);
                }
            }
            Err(err) => {
                report.errors += 1;
                tracing::error!("Outlook message {} failed: {err}", message.id);
                write_log(
                    pool,
                    &message,
                    None,
                    "error",
                    Some(&err.to_string()),
                    None,
                    attempts,
                )
                .await?;
                // Leave it unread for a retry, unless it has failed too often
                if attempts >= MAX_ATTEMPTS
                    && let Err(err) = client.mark_processed(&message.id).await
                {
                    tracing::warn!("Could not set aside message {}: {err}", message.id);
                }
            }
        }
    }

    Ok(report)
}

/// Imports the first invite attachment of the message; returns the outcome and the invite UID.
async fn process_message(
    pool: &PgPool,
    client: &dyn OutlookClient,
    fallback_user: uuid::Uuid,
    message: &InboxMessage,
) -> Result<(ImportOutcome, Option<String>), AppError> {
    let attachments = client
        .calendar_attachments(&message.id)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let Some(ics) = attachments.first() else {
        return Ok((
            ImportOutcome::Ignored("The message has no calendar invite attached".to_string()),
            None,
        ));
    };

    let invite: ParsedInvite = match ical::parse_invite(ics) {
        Ok(invite) => invite,
        // A broken attachment will not get better by retrying
        Err(err) => return Ok((ImportOutcome::Ignored(err.to_string()), None)),
    };

    let outcome = importer::import_invite(pool, fallback_user, &invite, Utc::now()).await?;
    Ok((outcome, Some(invite.uid)))
}

async fn previous_attempts(pool: &PgPool, message_id: &str) -> Result<i32, AppError> {
    Ok(sqlx::query_scalar!(
        "SELECT attempts FROM outlook_sync_log WHERE graph_message_id = $1",
        message_id
    )
    .fetch_optional(pool)
    .await?
    .unwrap_or(0))
}

async fn write_log(
    pool: &PgPool,
    message: &InboxMessage,
    ical_uid: Option<&str>,
    result: &str,
    detail: Option<&str>,
    reservation_id: Option<uuid::Uuid>,
    attempts: i32,
) -> Result<(), AppError> {
    sqlx::query!(
        r#"
        INSERT INTO outlook_sync_log (
            graph_message_id, received_at, subject, ical_uid, result, detail,
            reservation_id, attempts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (graph_message_id) DO UPDATE
        SET ical_uid = EXCLUDED.ical_uid, result = EXCLUDED.result, detail = EXCLUDED.detail,
            reservation_id = EXCLUDED.reservation_id, attempts = EXCLUDED.attempts,
            updated_at = NOW()
        "#,
        message.id,
        message.received_at,
        message.subject,
        ical_uid,
        result,
        detail,
        reservation_id,
        attempts
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn status(pool: &PgPool, config: &Config) -> Result<SyncStatus, AppError> {
    let recent = sqlx::query_as!(
        SyncLogEntry,
        r#"
        SELECT id, subject, ical_uid, result, detail, reservation_id, created_at
        FROM outlook_sync_log
        ORDER BY updated_at DESC
        LIMIT 50
        "#
    )
    .fetch_all(pool)
    .await?;

    let (last_run_at, last_error) = STATE
        .lock()
        .map(|s| (s.last_run_at, s.last_error.clone()))
        .unwrap_or_default();

    Ok(SyncStatus {
        enabled: config.outlook_enabled(),
        intake_mailbox: config.graph_intake_mailbox.clone(),
        last_run_at,
        last_error,
        recent,
    })
}
