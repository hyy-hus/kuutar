pub mod config;
pub mod domains;
pub mod errors;
pub mod openapi;
pub mod utils;

use axum::{Router, routing::get};
use config::Config;
use domains::{
    auth::{self, AuthState},
    collections, groups, reservations, resources,
};
use openapi::ApiDoc;
use sqlx::PgPool;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::domains::users;

pub fn app(pool: PgPool, config: Config) -> Router {
    let auth_state = AuthState {
        pool: pool.clone(),
        config: config.clone(),
    };

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/health", get(health_check))
        .nest("/auth", auth::router(auth_state.clone()))
        .nest("/users", users::router(auth_state.clone()))
        .nest("/groups", groups::router(auth_state.clone()))
        .nest("/collections", collections::router(auth_state.clone()))
        .nest("/reservations", reservations::router(auth_state.clone()))
        .nest("/resources", resources::router(auth_state))
}

async fn health_check() -> &'static str {
    "OK"
}
