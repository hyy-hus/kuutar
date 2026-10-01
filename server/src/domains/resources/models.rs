use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::rich_text::{LocalizedRichText, validate_localized_rich_text};
use crate::utils::trim::{deserialize_trimmed_option_string, deserialize_trimmed_string};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Resource {
    pub id: Uuid,
    pub collection_id: Uuid,
    pub name: String,
    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<serde_json::Value>,
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

    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    #[validate(custom(function = "validate_localized_rich_text"))]
    pub description: Option<LocalizedRichText>,

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
    // `default` lets partial updates omit the field entirely
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Name must be between 1 and 255 characters"
    ))]
    pub name: Option<String>,

    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    #[validate(custom(function = "validate_localized_rich_text"))]
    pub description: Option<LocalizedRichText>,

    pub allow_recurring: Option<bool>,

    pub reservable_until: Option<DateTime<Utc>>,

    pub is_public: Option<bool>,

    pub contract_ids: Option<Vec<Uuid>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_resource_allows_omitted_name() {
        let dto: UpdateResource =
            serde_json::from_str(r#"{"is_public": false}"#).expect("name should be optional");
        assert!(dto.name.is_none());
        assert_eq!(dto.is_public, Some(false));
    }
}
