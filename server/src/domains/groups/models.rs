use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::rich_text::{LocalizedRichText, validate_localized_rich_text};
use crate::utils::trim::deserialize_trimmed_string;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Group {
    pub id: Uuid,
    pub name: String,
    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateGroup {
    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(length(min = 1, message = "Group name cannot be empty"))]
    pub name: String,

    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    #[validate(custom(function = "validate_localized_rich_text"))]
    pub description: Option<LocalizedRichText>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateGroup {
    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(length(min = 1, message = "Group name cannot be empty"))]
    pub name: String,
    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    #[validate(custom(function = "validate_localized_rich_text"))]
    pub description: Option<LocalizedRichText>,
}
