use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::utils::trim::deserialize_trimmed_string;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String, // Always "Bearer"
    pub expires_in: u64,    // Access token lifetime in seconds
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct RegisterPayload {
    pub group_id: Uuid,

    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(email(message = "Invalid email address format"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct LoginPayload {
    #[serde(deserialize_with = "deserialize_trimmed_string")]
    #[validate(email(message = "Invalid email address format"))]
    pub email: String,

    #[validate(length(min = 1, message = "Password cannot be empty"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct RefreshPayload {
    pub refresh_token: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use validator::Validate;

    // --- RegisterPayload Tests ---

    #[test]
    fn test_register_payload_valid() {
        let payload = RegisterPayload {
            group_id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            password: "securepassword123".to_string(),
        };

        assert!(payload.validate().is_ok());
    }

    #[test]
    fn test_register_payload_invalid_email() {
        let payload = RegisterPayload {
            group_id: Uuid::new_v4(),
            email: "not-an-email".to_string(),
            password: "securepassword123".to_string(),
        };

        let result = payload.validate();
        assert!(result.is_err());

        let errors = result.unwrap_err().to_string();
        assert!(errors.contains("Invalid email address format"));
    }

    #[test]
    fn test_register_payload_short_password() {
        let payload = RegisterPayload {
            group_id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            password: "short".to_string(), // < 8 characters
        };

        let result = payload.validate();
        assert!(result.is_err());

        let errors = result.unwrap_err().to_string();
        assert!(errors.contains("Password must be at least 8 characters"));
    }

    // --- LoginPayload Tests ---

    #[test]
    fn test_login_payload_valid() {
        let payload = LoginPayload {
            email: "user@example.com".to_string(),
            password: "password123".to_string(),
        };

        assert!(payload.validate().is_ok());
    }

    #[test]
    fn test_login_payload_invalid_email() {
        let payload = LoginPayload {
            email: "bademail".to_string(),
            password: "password123".to_string(),
        };

        let result = payload.validate();
        assert!(result.is_err());

        let errors = result.unwrap_err().to_string();
        assert!(errors.contains("Invalid email address format"));
    }

    #[test]
    fn test_login_payload_empty_password() {
        let payload = LoginPayload {
            email: "user@example.com".to_string(),
            password: "".to_string(),
        };

        let result = payload.validate();
        assert!(result.is_err());

        let errors = result.unwrap_err().to_string();
        assert!(errors.contains("Password cannot be empty"));
    }

    // --- RefreshPayload Tests ---

    #[test]
    fn test_refresh_payload_valid() {
        let payload = RefreshPayload {
            refresh_token: "valid-token-string".to_string(),
        };

        assert!(payload.validate().is_ok());
    }
}
