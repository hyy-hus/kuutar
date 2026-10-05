use axum::{
    Json,
    extract::{Query, State},
};

use super::{
    db,
    models::{StatsQuery, StatsResponse},
};
use crate::{
    domains::{
        auth::{AuthState, extractor::OptionalAuthUser},
        users::models::Role,
    },
    errors::AppError,
};

/// GET /stats
#[utoipa::path(
    get,
    path = "/stats",
    tag = "Stats",
    params(StatsQuery),
    responses(
        (status = 200, description = "Usage statistics; `me` is included for authenticated users and `admin` for admins", body = StatsResponse),
        (status = 400, description = "Invalid range"),
    )
)]
#[tracing::instrument(skip(auth_state, opt_user))]
pub async fn get_stats(
    State(auth_state): State<AuthState>,
    opt_user: OptionalAuthUser,
    Query(query): Query<StatsQuery>,
) -> Result<Json<StatsResponse>, AppError> {
    let pool = &auth_state.pool;
    let from = query.range.from();

    let public = db::public_stats(pool, from).await?;
    let (me, admin) = match opt_user.0 {
        Some(user) => {
            let me = db::my_stats(pool, from, user.id).await?;
            let admin = if user.role == Role::Admin {
                Some(db::admin_stats(pool, from).await?)
            } else {
                None
            };
            (Some(me), admin)
        }
        None => (None, None),
    };

    Ok(Json(StatsResponse { public, me, admin }))
}
