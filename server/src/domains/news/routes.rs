use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db::{self, Viewer},
    models::{News, NewsInput, NewsSummary, UnreadNewsCount},
};
use crate::{
    domains::{
        auth::{
            AuthState,
            extractor::{AuthUser, OptionalAuthUser, RequireAdmin},
        },
        users::models::Role,
    },
    errors::AppError,
};

/// Highlights shown on the home page at most
const HIGHLIGHT_LIMIT: i64 = 3;

fn viewer(user: Option<&AuthUser>) -> Viewer {
    Viewer {
        is_admin: user.is_some_and(|u| u.role == Role::Admin),
        user_id: user.map(|u| u.id),
        group_id: user.map(|u| u.group_id),
    }
}

/// GET /news
#[utoipa::path(
    get,
    path = "/news",
    tag = "News",
    responses(
        (status = 200, description = "News visible to the requester, newest first; admins also get drafts and scheduled items", body = [NewsSummary]),
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn list_news(
    State(auth_state): State<AuthState>,
    OptionalAuthUser(user): OptionalAuthUser,
) -> Result<Json<Vec<NewsSummary>>, AppError> {
    let items = db::list(&auth_state.pool, viewer(user.as_ref())).await?;
    Ok(Json(items))
}

/// GET /news/highlights
#[utoipa::path(
    get,
    path = "/news/highlights",
    tag = "News",
    responses(
        (status = 200, description = "Published, highlighted news for the home page (unread only for signed-in users)", body = [NewsSummary]),
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn list_highlights(
    State(auth_state): State<AuthState>,
    OptionalAuthUser(user): OptionalAuthUser,
) -> Result<Json<Vec<NewsSummary>>, AppError> {
    let items =
        db::list_highlights(&auth_state.pool, viewer(user.as_ref()), HIGHLIGHT_LIMIT).await?;
    Ok(Json(items))
}

/// GET /news/unread-count
#[utoipa::path(
    get,
    path = "/news/unread-count",
    tag = "News",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Number of unread news items", body = UnreadNewsCount),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn unread_count(
    State(auth_state): State<AuthState>,
    user: AuthUser,
) -> Result<Json<UnreadNewsCount>, AppError> {
    let count = db::unread_count(&auth_state.pool, viewer(Some(&user)), user.id).await?;
    Ok(Json(UnreadNewsCount { count }))
}

/// POST /news/read-all
#[utoipa::path(
    post,
    path = "/news/read-all",
    tag = "News",
    security(("bearer_auth" = [])),
    responses(
        (status = 204, description = "All visible news marked read"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn mark_all_read(
    State(auth_state): State<AuthState>,
    user: AuthUser,
) -> Result<StatusCode, AppError> {
    db::mark_all_read(&auth_state.pool, viewer(Some(&user)), user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /news/{id}
#[utoipa::path(
    get,
    path = "/news/{id}",
    tag = "News",
    params(("id" = Uuid, Path, description = "News item UUID")),
    responses(
        (status = 200, description = "News item", body = News),
        (status = 404, description = "Not found or not visible to the requester")
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn get_news(
    State(auth_state): State<AuthState>,
    OptionalAuthUser(user): OptionalAuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<News>, AppError> {
    let item = db::find_by_id(&auth_state.pool, id, viewer(user.as_ref())).await?;
    Ok(Json(item))
}

/// POST /news/{id}/read
#[utoipa::path(
    post,
    path = "/news/{id}/read",
    tag = "News",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "News item UUID")),
    responses(
        (status = 204, description = "Marked read"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Not found or not visible to the requester")
    )
)]
#[tracing::instrument(skip(auth_state, user))]
pub async fn mark_read(
    State(auth_state): State<AuthState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let item = db::find_by_id(&auth_state.pool, id, viewer(Some(&user))).await?;
    db::mark_read(&auth_state.pool, user.id, item.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /news
#[utoipa::path(
    post,
    path = "/news",
    tag = "News",
    security(("bearer_auth" = [])),
    request_body = NewsInput,
    responses(
        (status = 201, description = "News item created", body = News),
        (status = 400, description = "Unknown group"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, admin, payload))]
pub async fn create_news(
    State(auth_state): State<AuthState>,
    RequireAdmin(admin): RequireAdmin,
    Json(mut payload): Json<NewsInput>,
) -> Result<(StatusCode, Json<News>), AppError> {
    payload.normalize();
    payload.validate()?;
    let id = db::create(&auth_state.pool, payload, admin.id).await?;
    let item = db::find_by_id(&auth_state.pool, id, viewer(Some(&admin))).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

/// PUT /news/{id}
#[utoipa::path(
    put,
    path = "/news/{id}",
    tag = "News",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "News item UUID")),
    request_body = NewsInput,
    responses(
        (status = 200, description = "News item replaced", body = News),
        (status = 400, description = "Unknown group"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, admin, payload))]
pub async fn update_news(
    State(auth_state): State<AuthState>,
    RequireAdmin(admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(mut payload): Json<NewsInput>,
) -> Result<Json<News>, AppError> {
    payload.normalize();
    payload.validate()?;
    db::update(&auth_state.pool, id, payload).await?;
    let item = db::find_by_id(&auth_state.pool, id, viewer(Some(&admin))).await?;
    Ok(Json(item))
}

/// DELETE /news/{id}
#[utoipa::path(
    delete,
    path = "/news/{id}",
    tag = "News",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path, description = "News item UUID")),
    responses(
        (status = 204, description = "News item soft-deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_news(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
