use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{CreateUser, UpdateUser, User},
};
use crate::{
    domains::auth::{
        AuthState,
        extractor::{AuthUser, RequireAdmin},
        password,
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
        (status = 200, description = "Current authenticated user profile", body = User),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_me(
    State(state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<Json<User>, AppError> {
    let user = db::get_user(&state.pool, auth_user.id).await?;
    Ok(Json(user))
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
    Ok((StatusCode::CREATED, Json(user)))
}

#[utoipa::path(
    patch,
    path = "/users/me",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = UpdateUser,
    responses(
        (status = 200, description = "Current user updated", body = User),
        (status = 409, description = "Email already in use")
    )
)]
pub async fn update_me(
    State(state): State<AuthState>,
    auth_user: AuthUser,
    Json(payload): Json<UpdateUser>,
) -> Result<Json<User>, AppError> {
    payload.validate()?;

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
    Ok(Json(user))
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
    Ok(Json(user))
}

#[utoipa::path(
    delete,
    path = "/users/me",
    tag = "Users",
    security(("bearer_auth" = [])),
    responses((status = 204, description = "Current user account deleted"))
)]
pub async fn delete_me(
    State(state): State<AuthState>,
    auth_user: AuthUser,
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
