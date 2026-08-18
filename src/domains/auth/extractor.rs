use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header::AUTHORIZATION, request::Parts},
};
use uuid::Uuid;

use super::{AuthState, jwt};
use crate::errors::AppError;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub group_id: Uuid,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AuthState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_state = AuthState::from_ref(state);

        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

        let token = auth_header.strip_prefix("Bearer ").ok_or_else(|| {
            AppError::Unauthorized("Invalid Authorization header format".to_string())
        })?;

        let claims = jwt::decode_jwt(token, &auth_state.config.jwt_secret)?;

        Ok(AuthUser {
            id: claims.sub,
            group_id: claims.group_id,
        })
    }
}
