use axum::{Json, extract::State};

use super::{
    graph::GraphClient,
    models::{SyncRunReport, SyncStatus},
    poller,
};
use crate::{
    domains::auth::{AuthState, extractor::RequireAdmin},
    errors::AppError,
};

#[utoipa::path(
    get,
    path = "/outlook-sync/status",
    tag = "Outlook sync",
    security(("bearer_auth" = [])),
    responses((status = 200, body = SyncStatus), (status = 403))
)]
pub async fn get_status(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
) -> Result<Json<SyncStatus>, AppError> {
    Ok(Json(
        poller::status(&auth_state.pool, &auth_state.config).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/outlook-sync/run",
    tag = "Outlook sync",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, body = SyncRunReport),
        (status = 400, description = "Outlook sync is not configured"),
        (status = 409, description = "A sync is already running"),
        (status = 403)
    )
)]
pub async fn run_sync(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
) -> Result<Json<SyncRunReport>, AppError> {
    let client = GraphClient::from_config(&auth_state.config)
        .map_err(|_| AppError::BadRequest("Outlook sync is not configured".to_string()))?;

    poller::run_cycle(&auth_state.pool, &auth_state.config, &client)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::Conflict("A sync is already running".to_string()))
}
