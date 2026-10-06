use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, ToSchema)]
pub struct SyncLogEntry {
    pub id: Uuid,
    pub subject: Option<String>,
    pub ical_uid: Option<String>,
    /// imported | updated | cancelled | ignored | error
    pub result: String,
    pub detail: Option<String>,
    pub reservation_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SyncStatus {
    /// False when the GRAPH_* settings are missing
    pub enabled: bool,
    pub intake_mailbox: Option<String>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub recent: Vec<SyncLogEntry>,
}

#[derive(Debug, Default, Serialize, ToSchema)]
pub struct SyncRunReport {
    pub messages: usize,
    pub imported: usize,
    pub updated: usize,
    pub cancelled: usize,
    pub ignored: usize,
    pub errors: usize,
}
