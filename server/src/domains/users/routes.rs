use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{CreateUser, Impersonator, MeResponse, UpdateUser, User},
};
use crate::{
    domains::{
        auth::{
            AuthState, db as auth_db,
            extractor::{AuthUser, RequireAdmin, RequireOwnAccount},
            models::SessionInfo,
            password,
            routes::to_session_info,
        },
        email_templates::notify,
    },
    errors::AppError,
};

#[utoipa::path(
    get,
    path = "/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    responses((status = 200, description = "List all active users", body = [User]))
)]
pub async fn list_users(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
) -> Result<Json<Vec<User>>, AppError> {
    let users = db::list_users(&state.pool).await?;
    Ok(Json(users))
}

#[utoipa::path(
    get,
    path = "/users/me",
    tag = "Users",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current authenticated user profile", body = MeResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_me(
    State(state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<Json<MeResponse>, AppError> {
    let user = db::get_user(&state.pool, auth_user.id).await?;
    Ok(Json(me_response(&state, &auth_user, user).await?))
}

/// Wraps the current user with the admin acting as them, if any
async fn me_response(
    state: &AuthState,
    auth_user: &AuthUser,
    user: User,
) -> Result<MeResponse, AppError> {
    let impersonator = match auth_user.impersonator_id {
        Some(admin_id) => {
            // A deleted admin's impersonation sessions end with them
            let admin = db::get_user(&state.pool, admin_id)
                .await
                .map_err(|e| match e {
                    AppError::NotFound => {
                        AppError::Unauthorized("Impersonation session has ended".to_string())
                    }
                    e => e,
                })?;
            Some(Impersonator {
                id: admin.id,
                name: admin.name,
                email: admin.email,
            })
        }
        None => None,
    };
    Ok(MeResponse { user, impersonator })
}

#[utoipa::path(
    get,
    path = "/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "User ID")),
    responses(
        (status = 200, description = "User details", body = User),
        (status = 404, description = "User not found")
    )
)]
pub async fn get_user(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, AppError> {
    let user = db::get_user(&state.pool, id).await?;
    Ok(Json(user))
}

#[utoipa::path(
    post,
    path = "/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = CreateUser,
    responses(
        (status = 201, description = "User created", body = User),
        (status = 400, description = "Group does not exist"),
        (status = 409, description = "Email already exists")
    )
)]
pub async fn create_user(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateUser>,
) -> Result<(StatusCode, Json<User>), AppError> {
    payload.validate()?;
    let password_hash = password::hash_password(&payload.password)?;
    let user = db::create_user(&state.pool, &payload, &password_hash).await?;
    notify::spawn_welcome_email(&state.pool, &state.config, user.id);
    Ok((StatusCode::CREATED, Json(user)))
}

#[utoipa::path(
    patch,
    path = "/users/me",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = UpdateUser,
    responses(
        (status = 200, description = "Current user updated (group_id is ignored)", body = MeResponse),
        (status = 403, description = "Email or password change while acting as another user"),
        (status = 409, description = "Email already in use")
    )
)]
pub async fn update_me(
    State(state): State<AuthState>,
    auth_user: AuthUser,
    Json(mut payload): Json<UpdateUser>,
) -> Result<Json<MeResponse>, AppError> {
    payload.validate()?;

    // An admin acting as the user may edit the profile, but not the login credentials.
    // The profile form always sends the email, so only an actual change counts.
    if auth_user.impersonator_id.is_some() {
        let email_changes = match &payload.email {
            Some(email) => {
                let current = db::get_user(&state.pool, auth_user.id).await?;
                !email.eq_ignore_ascii_case(&current.email)
            }
            None => false,
        };
        if email_changes || payload.password.is_some() {
            auth_user.ensure_own_account()?;
        }
    }

    // Users cannot move themselves between groups; that is an admin action
    payload.group_id = None;

    let new_password_hash = match &payload.password {
        Some(pwd) => Some(password::hash_password(pwd)?),
        None => None,
    };

    let user = db::update_user(
        &state.pool,
        auth_user.id,
        &payload,
        new_password_hash.as_deref(),
    )
    .await?;

    // A password change ends every other session
    if new_password_hash.is_some() {
        auth_db::revoke_all_sessions(&state.pool, auth_user.id, "password", auth_user.session_id)
            .await?;
    }
    Ok(Json(me_response(&state, &auth_user, user).await?))
}

#[utoipa::path(
    patch,
    path = "/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "User ID")),
    request_body = UpdateUser,
    responses(
        (status = 200, description = "User updated", body = User),
        (status = 404, description = "User not found")
    )
)]
pub async fn update_user(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUser>,
) -> Result<Json<User>, AppError> {
    payload.validate()?;

    let new_password_hash = match &payload.password {
        Some(pwd) => Some(password::hash_password(pwd)?),
        None => None,
    };

    let user = db::update_user(&state.pool, id, &payload, new_password_hash.as_deref()).await?;

    // A password reset ends all of the user's sessions
    if new_password_hash.is_some() {
        auth_db::revoke_all_sessions(&state.pool, id, "password", None).await?;
    }
    Ok(Json(user))
}

#[utoipa::path(
    delete,
    path = "/users/me",
    tag = "Users",
    security(("bearer_auth" = [])),
    responses(
        (status = 204, description = "Current user account deleted"),
        (status = 403, description = "Not allowed while acting as another user")
    )
)]
pub async fn delete_me(
    State(state): State<AuthState>,
    RequireOwnAccount(auth_user): RequireOwnAccount,
) -> Result<StatusCode, AppError> {
    db::delete_user(&state.pool, auth_user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "User ID")),
    responses(
        (status = 204, description = "User deleted"),
        (status = 404, description = "User not found")
    )
)]
pub async fn delete_user(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::delete_user(&state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/users/{id}/sessions",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "User ID")),
    responses((status = 200, description = "Active sessions of the user", body = [SessionInfo]))
)]
pub async fn list_user_sessions(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SessionInfo>>, AppError> {
    let sessions = auth_db::list_sessions(&state.pool, id).await?;
    Ok(Json(to_session_info(sessions, None)))
}

#[utoipa::path(
    delete,
    path = "/users/{id}/sessions",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "User ID")),
    responses((status = 204, description = "All sessions of the user ended"))
)]
pub async fn revoke_user_sessions(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    auth_db::revoke_all_sessions(&state.pool, id, "admin", None).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/users/{id}/sessions/{session_id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "User ID"),
        ("session_id" = Uuid, Path, description = "Session ID")
    ),
    responses(
        (status = 204, description = "Session ended"),
        (status = 404, description = "Session not found")
    )
)]
pub async fn revoke_user_session(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path((id, session_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    auth_db::revoke_session(&state.pool, id, session_id, "admin").await?;
    Ok(StatusCode::NO_CONTENT)
}
