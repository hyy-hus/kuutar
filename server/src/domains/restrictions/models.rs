use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RestrictionOccurrence {
    pub id: Uuid,
    pub restriction_id: Uuid,
    pub resource_id: Option<Uuid>, // None = applies globally to all resources
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Restriction {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub exempt_group_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RestrictionWithOccurrences {
    #[serde(flatten)]
    pub restriction: Restriction,
    pub occurrences: Vec<RestrictionOccurrence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateRestrictionOccurrencePayload {
    pub resource_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateRestrictionPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub exempt_group_ids: Option<Vec<Uuid>>,

    #[validate(length(min = 1, message = "At least one occurrence must be provided"))]
    #[validate(nested)]
    pub occurrences: Vec<CreateRestrictionOccurrencePayload>,
}

impl CreateRestrictionPayload {
    pub fn validate_times(&self) -> bool {
        self.occurrences
            .iter()
            .all(|occ| occ.start_time < occ.end_time)
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateRestrictionPayload {
    #[validate(length(min = 1, max = 255))]
    pub title: Option<String>,
    pub description: Option<String>,
    pub rrule: Option<String>,
    pub exempt_group_ids: Option<Vec<Uuid>>,

    #[validate(nested)]
    pub occurrences: Option<Vec<CreateRestrictionOccurrencePayload>>,
}

#[derive(Debug, Deserialize, Validate, utoipa::IntoParams)]
pub struct ListRestrictionsQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub resource_id: Option<Uuid>,
}
