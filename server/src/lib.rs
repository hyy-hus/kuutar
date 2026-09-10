pub mod config;
pub mod domains;
pub mod errors;
pub mod openapi;
pub mod seed;
pub mod utils;

use axum::http::{Method, header};
use axum::{Json, Router, response::IntoResponse, routing::get};
use config::Config;
use domains::{
    auth::{self, AuthState},
    collections, contracts, groups, reservations, resources, stats,
};
use openapi::ApiDoc;
use serde::Serialize;
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::domains::users;

pub fn app(pool: PgPool, config: Config) -> Router {
    let auth_state = AuthState {
        pool: pool.clone(),
        config: config.clone(),
    };

    let swagger_router: Router = SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", ApiDoc::openapi())
        .into();

    let cors = CorsLayer::new()
        .allow_origin(Any) // Or restrict to "https://kuutar-staging.s3-website.fr-par.scw.cloud".parse::<HeaderValue>().uanwrap()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT]);

    Router::new()
        .merge(swagger_router)
        .route("/health", get(health_check))
        .nest("/auth", auth::router(auth_state.clone()))
        .nest("/users", users::router(auth_state.clone()))
        .nest("/groups", groups::router(auth_state.clone()))
        .nest("/collections", collections::router(auth_state.clone()))
        .nest("/reservations", reservations::router(auth_state.clone()))
        .nest("/contracts", contracts::router(auth_state.clone()))
        .nest("/resources", resources::router(auth_state.clone()))
        .nest("/stats", stats::router(auth_state))
        .layer(cors)
}

#[derive(Serialize)]
pub struct HealthStatus {
    pub status: &'static str,
    pub version: &'static str,
}

pub async fn health_check() -> impl IntoResponse {
    Json(HealthStatus {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}
