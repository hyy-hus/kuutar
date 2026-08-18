pub mod db;
pub mod extractor;
pub mod jwt;
pub mod models;
pub mod password;
pub mod routes;

use axum::{Router, routing::post};

pub use extractor::AuthUser;
pub use routes::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/register", post(routes::register))
        .route("/login", post(routes::login))
        .route("/refresh", post(routes::refresh))
        .route("/logout", post(routes::logout))
        .with_state(state)
}
