use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::rich_text::{LocalizedRichText, validate_localized_rich_text};
use crate::utils::trim::{deserialize_trimmed_option_string, deserialize_trimmed_string};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Collection {
    pub id: Uuid,
    pub name: String,
    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub description: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateCollection {
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
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateCollection {
    #[serde(deserialize_with = "deserialize_trimmed_option_string")]
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_collection_valid() {
        let dto = CreateCollection {
            name: "Valid Collection Name".to_string(),
            description: None,
        };

        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_create_collection_empty_name() {
        let dto = CreateCollection {
            name: "".to_string(),
            description: None,
        };
        let result = dto.validate();
        assert!(result.is_err());

        let errors = result.unwrap_err();
        assert!(
            errors
                .to_string()
                .contains("Name must be between 1 and 255 characters")
        );
    }

    #[test]
    fn test_update_collection_none_is_valid() {
        let dto = UpdateCollection {
            name: None,
            description: None,
        };
        // Option::None should pass validation for partial updates
        assert!(dto.validate().is_ok());
    }
}
