use axum::{
    extract::{FromRef, FromRequestParts},
    http::{Method, header::AUTHORIZATION, request::Parts},
};
use uuid::Uuid;

use super::{AuthState, jwt};
use crate::{domains::users::models::Role, errors::AppError};

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub group_id: Uuid,
    pub role: Role,
    /// Session this access token belongs to (None for tokens issued before sessions existed)
    pub session_id: Option<Uuid>,
    /// Admin acting as this user, when the session is an impersonation session
    pub impersonator_id: Option<Uuid>,
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

        // Until the audit log lands, every change made while impersonating is logged here
        if let Some(admin_id) = claims.act
            && parts.method != Method::GET
        {
            tracing::info!(
                admin_id = %admin_id,
                user_id = %claims.sub,
                method = %parts.method,
                path = %parts.uri.path(),
                "Impersonated request"
            );
        }

        Ok(AuthUser {
            id: claims.sub,
            group_id: claims.group_id,
            role: claims.role,
            session_id: claims.sid,
            impersonator_id: claims.act,
        })
    }
}

/// Requires the user to act on their own account, i.e. not be an admin impersonating them.
/// Used for account-level actions (sessions, deleting the account).
#[derive(Debug, Clone)]
pub struct RequireOwnAccount(pub AuthUser);

impl AuthUser {
    pub fn ensure_own_account(&self) -> Result<(), AppError> {
        if self.impersonator_id.is_some() {
            return Err(AppError::Forbidden(
                "Not allowed while acting as another user".to_string(),
            ));
        }
        Ok(())
    }
}

impl<S> FromRequestParts<S> for RequireOwnAccount
where
    S: Send + Sync,
    AuthState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        user.ensure_own_account()?;
        Ok(RequireOwnAccount(user))
    }
}

/// Requires the user to be an Admin
#[derive(Debug, Clone)]
pub struct RequireAdmin(pub AuthUser);

impl<S> FromRequestParts<S> for RequireAdmin
where
    S: Send + Sync,
    AuthState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if user.role != Role::Admin {
            return Err(AppError::Forbidden("Admin privileges required".to_string()));
        }
        Ok(RequireAdmin(user))
    }
}

/// Optional extractor: returns `Some(AuthUser)` if a valid Bearer token is present,
/// or `None` if no Authorization header is sent. A header that is present but
/// invalid or expired is rejected (401) so clients can refresh their token
/// instead of silently being served the guest view.
#[derive(Debug, Clone)]
pub struct OptionalAuthUser(pub Option<AuthUser>);

impl<S> FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
    AuthState: axum::extract::FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        if !parts.headers.contains_key(AUTHORIZATION) {
            return Ok(OptionalAuthUser(None));
        }
        AuthUser::from_request_parts(parts, state)
            .await
            .map(|user| OptionalAuthUser(Some(user)))
    }
}
