use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::rich_text::{LocalizedRichText, validate_localized_rich_text};

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

    /// Public, localized rich text: `{"fi": {"type": "doc", ...}}`. Visible to everyone.
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<serde_json::Value>,

    /// Information from the reserver to the admins. Visible only to the owner and admins.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_to_admins: Option<String>,

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

    /// `kuutar`, or `outlook` for events imported from Outlook (edited there, read-only here)
    pub source: String,

    pub contract_id: Option<Uuid>,
    pub contract_printed_at: Option<DateTime<Utc>>,

    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancelled_by: Option<Uuid>,
    pub cancel_reason: Option<String>,

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
    /// Admins only: create the reservation on behalf of this user.
    pub user_id: Option<Uuid>,

    #[validate(length(min = 1, max = 255))]
    pub title: String,
    /// Localized rich text. Send `{}` to clear; omitting keeps the current value.
    #[validate(custom(function = "validate_localized_rich_text"))]
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<LocalizedRichText>,
    /// Plain text for the admins. Send an empty string to clear.
    #[validate(length(max = 2000))]
    pub message_to_admins: Option<String>,
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
    /// Localized rich text. Send `{}` to clear; omitting keeps the current value.
    #[validate(custom(function = "validate_localized_rich_text"))]
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<LocalizedRichText>,
    /// Plain text for the admins. Send an empty string to clear.
    #[validate(length(max = 2000))]
    pub message_to_admins: Option<String>,
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

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct SplitReservationPayload {
    /// Occurrences to move into a new, non-recurring reservation. A reservation on several
    /// resources has one occurrence per resource at each time, so pass all of that time's rows.
    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    pub occurrence_ids: Vec<Uuid>,

    /// The rule the original reservation keeps, e.g. with an EXDATE for the occurrence that left
    pub rrule: Option<String>,
}

#[derive(Debug, Default, Deserialize, Validate, ToSchema)]
pub struct CancelReservationPayload {
    /// Optional explanation, included in the cancellation email
    #[validate(length(max = 500))]
    pub reason: Option<String>,
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

/// Exports made before descriptions became rich text carry a plain string.
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PortableDescription {
    Text(String),
    Rich(LocalizedRichText),
}

impl PortableDescription {
    /// The JSONB value to store, or `None` when there is nothing to store.
    pub fn into_json(self) -> Option<serde_json::Value> {
        let rich = match self {
            Self::Text(text) => crate::utils::rich_text::from_plain_text(&text),
            Self::Rich(rich) => rich,
        };
        (!rich.is_empty()).then(|| crate::utils::rich_text::to_json(rich))
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PortableReservationImport {
    pub user_email: Option<String>,
    pub title: String,
    /// Localized rich text, or a plain string from older exports
    #[schema(value_type = Option<serde_json::Value>)]
    pub description: Option<PortableDescription>,
    pub message_to_admins: Option<String>,
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
