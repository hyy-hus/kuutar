use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::trim::{deserialize_trimmed_option_string, deserialize_trimmed_string};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Contract {
    pub id: Uuid,
    pub name: String,
    pub body: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateContract {
    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Name must be between 1 and 255 characters"
    ))]
    pub name: String,

    /// Tiptap ProseMirror JSON representation
    pub body: serde_json::Value,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateContract {
    #[serde(deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Name must be between 1 and 255 characters"
    ))]
    pub name: Option<String>,

    pub body: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_contract_valid() {
        let dto = CreateContract {
            name: "Sauna Rental Agreement".to_string(),
            body: serde_json::json!({ "type": "doc", "content": [] }),
        };

        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_create_contract_empty_name() {
        let dto = CreateContract {
            name: "".to_string(),
            body: serde_json::json!({}),
        };
        assert!(dto.validate().is_err());
    }
}
