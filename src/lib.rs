pub mod config;
pub mod domains;
pub mod errors;
pub mod openapi;
pub mod utils;

use axum::{Router, http::StatusCode, routing::get};
use sqlx::PgPool;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Constructs the entire Axum application router with state and middleware.
/// Used by both `main.rs` (production) and integration tests.
pub fn app(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .merge(
            SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi::ApiDoc::openapi()),
        )
        .nest("/collections", domains::collections::router())
        .nest("/resources", domains::resources::router())
        .with_state(pool)
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
