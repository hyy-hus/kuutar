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
    /// Icon key (see `COLLECTION_ICONS`)
    pub icon: Option<String>,
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

    #[validate(custom(function = "validate_icon"))]
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateCollection {
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

    /// Icon key; an empty string clears the icon
    #[validate(custom(function = "validate_icon"))]
    pub icon: Option<String>,
}

/// Icon keys; must match the CHECK constraint on `collections.icon`
pub const COLLECTION_ICONS: &[&str] = &[
    "layers", "wrench", "car", "home", "projector", "camera", "music", "utensils", "bike", "tent",
    "users", "monitor", "mic", "book", "gamepad", "palette", "hammer", "truck", "sofa", "trees",
    "dumbbell", "laptop", "printer", "shirt",
];

fn validate_icon(icon: &str) -> Result<(), validator::ValidationError> {
    if icon.is_empty() || COLLECTION_ICONS.contains(&icon) {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_icon"))
    }
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
            icon: None,
        };

        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_create_collection_empty_name() {
        let dto = CreateCollection {
            name: "".to_string(),
            description: None,
            icon: None,
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
            icon: None,
        };
        // Option::None should pass validation for partial updates
        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_icon_validation() {
        assert!(validate_icon("wrench").is_ok());
        assert!(validate_icon("").is_ok());
        assert!(validate_icon("<svg>").is_err());
    }

    #[test]
    fn test_update_collection_allows_omitted_name() {
        let dto: UpdateCollection =
            serde_json::from_str(r#"{"description": {}}"#).expect("name should be optional");
        assert!(dto.name.is_none());
    }
}
