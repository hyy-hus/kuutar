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
    pub user_id: Uuid,

    // Creator Metadata (Publicly visible)
    pub user_name: Option<String>,

    // Admin-Only Creator Details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_email: Option<String>,

    pub title: String,
    pub description: Option<String>,

    // Admin-Only Contact Details & Notes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_notes: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_person: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_phone: Option<String>,

    pub rrule: Option<String>,
    pub status: ReservationStatus,

    pub contract_id: Option<Uuid>,
    pub contract_printed_at: Option<DateTime<Utc>>,

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
    pub admin_notes: Option<String>,

    // Optional Contact Info provided during creation
    pub contact_person: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,

    pub rrule: Option<String>,
    pub status: Option<ReservationStatus>,

    pub contract_id: Option<Uuid>,

    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    #[validate(nested)]
    pub occurrences: Vec<CreateOccurrencePayload>,
}

impl CreateReservationPayload {
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
    pub admin_notes: Option<String>,

    pub contact_person: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,

    pub rrule: Option<String>,
    pub status: Option<ReservationStatus>,

    pub contract_id: Option<Uuid>,
    pub mark_printed: Option<bool>,

    #[validate(nested)]
    pub occurrences: Option<Vec<CreateOccurrencePayload>>,
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct CheckConflictsQuery {
    /// Reservation being edited; its own occurrences are ignored
    pub exclude_reservation_id: Option<uuid::Uuid>,
}

#[derive(Debug, Deserialize, Validate, utoipa::IntoParams)]
pub struct ListReservationsQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub resource_id: Option<uuid::Uuid>,
    pub status: Option<super::models::ReservationStatus>,
}

impl ListReservationsQuery {
    pub fn validate_range(&self, max_days: i64) -> bool {
        match (self.start_date, self.end_date) {
            (Some(start), Some(end)) => {
                if end < start {
                    return false;
                }
                (end - start).num_days() <= max_days
            }
            _ => true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PortableOccurrenceImport {
    pub resource_name: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PortableReservationImport {
    pub user_email: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub admin_notes: Option<String>,
    pub contact_person: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub rrule: Option<String>,
    pub status: Option<ReservationStatus>,
    pub occurrences: Vec<PortableOccurrenceImport>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BatchImportReport {
    pub imported_count: usize,
    pub reservation_ids: Vec<Uuid>,
}
