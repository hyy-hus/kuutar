use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{domains::users::models::Role, errors::AppError};

/// Claims embedded inside every issued Access JWT
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,      // User ID
    pub group_id: Uuid, // Group ID
    pub role: Role,
    pub exp: usize, // Expiration Unix Timestamp
    pub iat: usize, // Issued At Unix Timestamp
}

/// Encodes a JWT token with user_id, group_id, role, and an expiration TTL in seconds.
pub fn encode_jwt(
    user_id: Uuid,
    group_id: Uuid,
    role: Role,
    secret: &str,
    expiration_seconds: u64,
) -> Result<String, AppError> {
    let now = Utc::now();
    let expire = now + Duration::seconds(expiration_seconds as i64);

    let claims = Claims {
        sub: user_id,
        group_id,
        role, // Added missing role field
        exp: expire.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalServerError(format!("JWT encoding error: {e}")))
}

/// Decodes and validates a JWT token signature and expiration against the secret key.
pub fn decode_jwt(token: &str, secret: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid or expired access token".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::users::models::Role;

    const TEST_SECRET: &str = "super-secret-key-for-testing-jwt-12345";

    #[test]
    fn test_encode_and_decode_jwt_success() {
        let user_id = Uuid::new_v4();
        let group_id = Uuid::new_v4();
        let role = Role::Admin;

        let token = encode_jwt(user_id, group_id, role, TEST_SECRET, 900)
            .expect("Encoding JWT should succeed");

        let claims = decode_jwt(&token, TEST_SECRET).expect("Decoding JWT should succeed");

        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.group_id, group_id);
        assert_eq!(claims.role, Role::Admin);
    }

    #[test]
    fn test_decode_jwt_wrong_secret() {
        let user_id = Uuid::new_v4();
        let group_id = Uuid::new_v4();

        let token = encode_jwt(user_id, group_id, Role::User, TEST_SECRET, 900)
            .expect("Encoding JWT should succeed");

        let result = decode_jwt(&token, "wrong-secret-key-12345");
        assert!(matches!(result, Err(AppError::Unauthorized(_))));
    }

    #[test]
    fn test_decode_jwt_malformed_token() {
        let result = decode_jwt("not.a.valid.jwt.string", TEST_SECRET);
        assert!(matches!(result, Err(AppError::Unauthorized(_))));
    }

    #[test]
    fn test_decode_jwt_expired() {
        let user_id = Uuid::new_v4();
        let group_id = Uuid::new_v4();

        // jsonwebtoken's Validation::default() allows a 60-second clock skew (leeway).
        // To reliably test expiration, we set `exp` to 120 seconds in the past.
        let now = Utc::now();
        let expired_time = now - Duration::seconds(120);

        let expired_claims = Claims {
            sub: user_id,
            group_id,
            role: Role::User,
            exp: expired_time.timestamp() as usize,
            iat: (now - Duration::seconds(300)).timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &expired_claims,
            &EncodingKey::from_secret(TEST_SECRET.as_bytes()),
        )
        .unwrap();

        let result = decode_jwt(&token, TEST_SECRET);
        assert!(matches!(result, Err(AppError::Unauthorized(_))));
    }
}
