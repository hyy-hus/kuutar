use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::trim::{deserialize_trimmed_option_string, deserialize_trimmed_string};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Resource {
    pub id: Uuid,
    pub collection_id: Uuid,
    pub name: String,
    pub allow_recurring: bool,
    pub reservable_until: Option<DateTime<Utc>>,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateResource {
    pub collection_id: Uuid,

    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Name must be between 1 and 255 characters"
    ))]
    pub name: String,

    #[serde(default)]
    pub allow_recurring: bool,

    pub reservable_until: Option<DateTime<Utc>>,

    #[serde(default = "default_true")]
    pub is_public: bool,

    pub contract_ids: Option<Vec<Uuid>>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateResource {
    #[serde(deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Name must be between 1 and 255 characters"
    ))]
    pub name: Option<String>,

    pub allow_recurring: Option<bool>,

    pub reservable_until: Option<DateTime<Utc>>,

    pub is_public: Option<bool>,

    pub contract_ids: Option<Vec<Uuid>>,
}
