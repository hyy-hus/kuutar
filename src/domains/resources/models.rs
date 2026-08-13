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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_resource_valid() {
        let dto = CreateResource {
            collection_id: Uuid::new_v4(),
            name: "Valid Resource Name".to_string(),
        };

        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_create_resource_empty_name() {
        let dto = CreateResource {
            collection_id: Uuid::new_v4(),
            name: "".to_string(),
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
    fn test_create_resource_whitespace_only_trimmed_and_invalid() {
        let json = format!(
            r#"{{"collection_id": "{}", "name": "   "}}"#,
            Uuid::new_v4()
        );
        let dto: Result<CreateResource, _> = serde_json::from_str(&json);
        assert!(dto.is_ok());

        let dto = dto.unwrap();
        // Trimming stripped "   " to "", so name length is 0
        assert_eq!(dto.name, "");
        assert!(dto.validate().is_err());
    }

    #[test]
    fn test_update_resource_none_is_valid() {
        let dto = UpdateResource { name: None };
        // Option::None should pass validation for partial updates
        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_update_resource_whitespace_only_trimmed_and_invalid() {
        let json = r#"{"name": "   "}"#;
        let dto: Result<UpdateResource, _> = serde_json::from_str(json);
        assert!(dto.is_ok());

        let dto = dto.unwrap();
        // Trimming stripped "   " to Some("")
        assert_eq!(dto.name, Some("".to_string()));
        assert!(dto.validate().is_err());
    }
}
