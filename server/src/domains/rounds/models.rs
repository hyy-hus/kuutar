use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::domains::reservations::models::ReservationStatus;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "round_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RoundStatus {
    Active,
    Completed,
}

/// Where a round is in its lifecycle, derived from its status and times.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RoundPhase {
    /// Created, applications not yet open
    Upcoming,
    /// Accepting applications
    Open,
    /// Applications closed; waiting for the admins to allocate and complete
    Allocating,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Round {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub applications_open_at: DateTime<Utc>,
    pub applications_close_at: DateTime<Utc>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub max_pending_per_resource: i32,
    pub status: RoundStatus,
    pub phase: RoundPhase,
    pub completed_at: Option<DateTime<Utc>>,
    pub allocation_saved_at: Option<DateTime<Utc>>,
    pub resource_ids: Vec<Uuid>,
    pub group_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl RoundPhase {
    pub fn derive(
        status: RoundStatus,
        open_at: DateTime<Utc>,
        close_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Self {
        if status == RoundStatus::Completed {
            Self::Completed
        } else if now < open_at {
            Self::Upcoming
        } else if now < close_at {
            Self::Open
        } else {
            Self::Allocating
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateRoundPayload {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    pub applications_open_at: DateTime<Utc>,
    pub applications_close_at: DateTime<Utc>,
    /// The blocks that can be applied for must fall inside this period
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    #[validate(range(min = 1, max = 100))]
    pub max_pending_per_resource: i32,
    #[validate(length(min = 1, message = "At least one resource is required"))]
    pub resource_ids: Vec<Uuid>,
    #[validate(length(min = 1, message = "At least one group is required"))]
    pub group_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateRoundPayload {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    pub applications_open_at: Option<DateTime<Utc>>,
    pub applications_close_at: Option<DateTime<Utc>>,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    #[validate(range(min = 1, max = 100))]
    pub max_pending_per_resource: Option<i32>,
    pub resource_ids: Option<Vec<Uuid>>,
    pub group_ids: Option<Vec<Uuid>>,
}

/// One application (a pending reservation) in a round, with what the allocation needs.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RoundApplication {
    pub reservation_id: Uuid,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub title: String,
    /// Localized rich text, as on the reservation
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<serde_json::Value>,
    pub message_to_admins: Option<String>,
    pub contact_person: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    /// `pending` until the round is completed, then `confirmed` (granted) or `cancelled`
    pub status: ReservationStatus,
    pub resource_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub priority: i32,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct SetPrioritiesPayload {
    pub resource_id: Uuid,
    /// All of the caller's applications for the resource in this round, best first
    pub reservation_ids: Vec<Uuid>,
}

#[derive(Debug, Default, Deserialize, ToSchema)]
pub struct AllocatePayload {
    /// Seed for the shuffle; omit for a random one. The same seed gives the same result.
    pub seed: Option<u64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AllocationProposal {
    pub seed: u64,
    /// Reservations to grant. Every other application in the round is denied.
    pub reservation_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct Allocation {
    pub saved: bool,
    pub reservation_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SaveAllocationPayload {
    pub reservation_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CompleteRoundReport {
    pub confirmed_count: usize,
    pub cancelled_count: usize,
}
