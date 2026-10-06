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
    /// When true, non-admin users can only reserve whole reservable blocks
    pub blocks_only: bool,
    pub reservable_until: Option<DateTime<Utc>>,
    pub is_public: bool,
    /// When true, non-admins can only reserve if their group is in `reservable_group_ids`
    pub reservation_restricted: bool,
    /// Groups allowed to reserve this resource when `reservation_restricted` is set
    pub reservable_group_ids: Vec<Uuid>,
    /// Whether the requesting user may reserve this resource (always true for admins)
    pub can_reserve: bool,
    /// When true, non-admin reservations of this resource are confirmed immediately
    pub auto_confirm: bool,
    /// Groups whose reservations are auto-confirmed; empty means every group
    pub auto_confirm_group_ids: Vec<Uuid>,
    /// Palette key (see `RESOURCE_COLORS`) for the resource's calendar events
    pub color: Option<String>,
    /// Outlook room/equipment mailbox of the resource (admins only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outlook_email: Option<String>,
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

    #[serde(default)]
    pub blocks_only: bool,

    pub reservable_until: Option<DateTime<Utc>>,

    #[serde(default = "default_true")]
    pub is_public: bool,

    #[serde(default)]
    pub reservation_restricted: bool,

    /// Groups allowed to reserve the resource when `reservation_restricted` is set
    pub group_ids: Option<Vec<Uuid>>,

    #[serde(default)]
    pub auto_confirm: bool,

    /// Groups auto-confirmed when `auto_confirm` is set; empty or omitted means every group
    pub auto_confirm_group_ids: Option<Vec<Uuid>>,

    #[validate(custom(function = "validate_color"))]
    pub color: Option<String>,

    pub contract_ids: Option<Vec<Uuid>>,

    /// Outlook room/equipment mailbox whose invites are shown as reservations of this resource
    #[validate(custom(function = "validate_outlook_email"))]
    pub outlook_email: Option<String>,
}

/// Calendar color keys; must match the CHECK constraint on `resources.color`
pub const RESOURCE_COLORS: &[&str] = &[
    "red", "orange", "amber", "lime", "emerald", "teal", "sky", "blue", "violet", "pink",
];

fn validate_color(color: &str) -> Result<(), validator::ValidationError> {
    if color.is_empty() || RESOURCE_COLORS.contains(&color) {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_color"))
    }
}

fn validate_outlook_email(email: &str) -> Result<(), validator::ValidationError> {
    let email = email.trim();
    if email.is_empty() || (email.contains('@') && !email.contains(char::is_whitespace)) {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_email"))
    }
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

    pub blocks_only: Option<bool>,

    pub reservable_until: Option<DateTime<Utc>>,

    pub is_public: Option<bool>,

    pub reservation_restricted: Option<bool>,

    /// Replaces the set of groups allowed to reserve the resource
    pub group_ids: Option<Vec<Uuid>>,

    pub auto_confirm: Option<bool>,

    /// Replaces the set of auto-confirmed groups
    pub auto_confirm_group_ids: Option<Vec<Uuid>>,

    /// Palette key; an empty string clears the color
    #[validate(custom(function = "validate_color"))]
    pub color: Option<String>,

    pub contract_ids: Option<Vec<Uuid>>,

    /// Outlook mailbox; an empty string clears it
    #[validate(custom(function = "validate_outlook_email"))]
    pub outlook_email: Option<String>,
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
