use axum::{Json, extract::State};

use super::{db, models::SystemStats};
use crate::{domains::auth::AuthState, errors::AppError};

/// GET /stats
#[utoipa::path(
    get,
    path = "/stats",
    tag = "Stats",
    responses(
        (status = 200, description = "System usage and metrics breakdown", body = SystemStats),
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn get_stats(State(auth_state): State<AuthState>) -> Result<Json<SystemStats>, AppError> {
    let stats = db::get_system_stats(&auth_state.pool).await?;
    Ok(Json(stats))
}
