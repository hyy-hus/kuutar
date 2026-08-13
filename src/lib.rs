pub mod domains;
pub mod errors;
mod utils;

use axum::{Router, http::StatusCode, routing::get};
use sqlx::PgPool;

/// Constructs the entire Axum application router with state and middleware.
/// Used by both `main.rs` (production) and integration tests.
pub fn app(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .nest("/collections", domains::collections::router())
        .nest("/resources", domains::resources::router())
        .with_state(pool)
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
