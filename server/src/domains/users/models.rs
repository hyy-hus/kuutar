use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{Validate, ValidateEmail};

use crate::utils::trim::{deserialize_trimmed_option_string, deserialize_trimmed_string};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct User {
    pub id: Uuid,
    pub group_id: Uuid,
    pub role: Role,
    pub name: String,
    pub email: String,
    pub default_contact_person: Option<String>,
    pub default_contact_email: Option<String>,
    pub default_contact_phone: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateUser {
    pub group_id: Uuid,

    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,

    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(email(message = "Invalid email address format"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateUser {
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    pub name: Option<String>,

    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(email(message = "Invalid email address format"))]
    pub email: Option<String>,

    #[serde(default)]
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: Option<String>,

    /// Required by `PATCH /users/me` when a non-admin changes their password.
    #[serde(default)]
    pub current_password: Option<String>,

    pub group_id: Option<Uuid>,

    /// Empty string clears the value; omitted leaves it unchanged.
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(length(max = 255))]
    pub default_contact_person: Option<String>,

    /// Empty string clears the value; omitted leaves it unchanged.
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(custom(function = "validate_optional_email"))]
    pub default_contact_email: Option<String>,

    /// Empty string clears the value; omitted leaves it unchanged.
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(length(max = 64))]
    pub default_contact_phone: Option<String>,
}

fn validate_optional_email(value: &str) -> Result<(), validator::ValidationError> {
    if value.is_empty() || value.validate_email() {
        Ok(())
    } else {
        Err(validator::ValidationError::new("email"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "user_role", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    User,
}
