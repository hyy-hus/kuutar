use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReservableBlockOccurrence {
    pub id: Uuid,
    pub block_id: Uuid,
    pub resource_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    /// True when a confirmed or pending reservation already overlaps this occurrence
    pub reserved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReservableBlock {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReservableBlockWithOccurrences {
    #[serde(flatten)]
    pub block: ReservableBlock,
    pub occurrences: Vec<ReservableBlockOccurrence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateReservableBlockOccurrencePayload {
    pub resource_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateReservableBlockPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,

    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    #[validate(nested)]
    pub occurrences: Vec<CreateReservableBlockOccurrencePayload>,
}

impl CreateReservableBlockPayload {
    pub fn validate_times(&self) -> bool {
        self.occurrences
            .iter()
            .all(|occ| occ.start_time < occ.end_time)
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateReservableBlockPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: Option<String>,
    pub description: Option<String>,
    pub rrule: Option<String>,

    /// Replaces all occurrences when provided
    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    #[validate(nested)]
    pub occurrences: Option<Vec<CreateReservableBlockOccurrencePayload>>,
}

impl UpdateReservableBlockPayload {
    pub fn validate_times(&self) -> bool {
        self.occurrences
            .iter()
            .flatten()
            .all(|occ| occ.start_time < occ.end_time)
    }
}

#[derive(Debug, Deserialize, Validate, utoipa::IntoParams)]
pub struct ListReservableBlocksQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub resource_id: Option<Uuid>,
}
