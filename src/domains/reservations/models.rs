use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "reservation_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ReservationStatus {
    Pending,
    Confirmed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Reservation {
    pub id: Uuid,
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub status: ReservationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Occurrence {
    pub id: Uuid,
    pub reservation_id: Uuid,
    pub resource_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReservationWithOccurrences {
    #[serde(flatten)]
    pub reservation: Reservation,
    pub occurrences: Vec<Occurrence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateOccurrencePayload {
    pub resource_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateReservationPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub status: Option<ReservationStatus>,

    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    #[validate(nested)]
    pub occurrences: Vec<CreateOccurrencePayload>,
}

impl CreateReservationPayload {
    /// Helper to validate time order across all occurrences in the payload
    pub fn validate_occurrence_times(&self) -> bool {
        self.occurrences
            .iter()
            .all(|occ| occ.start_time < occ.end_time)
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateReservationPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: Option<String>,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub status: Option<ReservationStatus>,
}
