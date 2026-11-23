use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{Validate, ValidateEmail};

use crate::utils::{
    redact::{Redacted, redact_option},
    trim::{deserialize_trimmed_option_string, deserialize_trimmed_string},
};
use std::fmt;

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
    /// Preferred language code (`fi`, `sv` or `en`), used for emails.
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// The admin acting as the current user (impersonation)
#[derive(Debug, Serialize, ToSchema)]
pub struct Impersonator {
    pub id: Uuid,
    pub name: String,
    pub email: String,
}

/// The current user, plus the admin behind the session when an admin is acting as them
#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    #[serde(flatten)]
    pub user: User,
    pub impersonator: Option<Impersonator>,
}

#[derive(Deserialize, Validate, ToSchema)]
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

    /// Preferred language code (`fi`, `sv` or `en`); defaults to `fi`.
    #[validate(custom(function = "crate::utils::lang::validate_language"))]
    pub language: Option<String>,
}

#[derive(Deserialize, Validate, ToSchema)]
pub struct UpdateUser {
    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    pub name: Option<String>,

    #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
    #[validate(email(message = "Invalid email address format"))]
    pub email: Option<String>,

    #[serde(default)]
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: Option<String>,

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

    /// Preferred language code: `fi`, `sv` or `en`.
    #[validate(custom(function = "crate::utils::lang::validate_language"))]
    pub language: Option<String>,
}

// Hand-written so passwords never reach the logs
impl fmt::Debug for CreateUser {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CreateUser")
            .field("group_id", &self.group_id)
            .field("name", &self.name)
            .field("email", &self.email)
            .field("password", &Redacted)
            .field("language", &self.language)
            .finish()
    }
}

impl fmt::Debug for UpdateUser {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("UpdateUser")
            .field("name", &self.name)
            .field("email", &self.email)
            .field("password", &redact_option(&self.password))
            .field("group_id", &self.group_id)
            .field("default_contact_person", &self.default_contact_person)
            .field("default_contact_email", &self.default_contact_email)
            .field("default_contact_phone", &self.default_contact_phone)
            .field("language", &self.language)
            .finish()
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_redacts_passwords() {
        let create = CreateUser {
            group_id: Uuid::nil(),
            name: "Test".into(),
            email: "user@example.test".into(),
            password: "hunter2-secret".into(),
            language: None,
        };
        let update = UpdateUser {
            name: None,
            email: None,
            password: Some("hunter2-secret".into()),
            group_id: None,
            default_contact_person: None,
            default_contact_email: None,
            default_contact_phone: None,
            language: None,
        };
        let out = format!("{create:?} {update:?}");
        assert!(!out.contains("hunter2-secret"), "{out}");
        assert!(out.contains("password: Some(<redacted>)"), "{out}");
    }
}
