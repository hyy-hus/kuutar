pub mod db;
pub mod extractor;
pub mod jwt;
pub mod models;
pub mod password;
pub mod purge;
pub mod routes;

use axum::{
    Router,
    routing::{delete, get, post},
};

pub use extractor::AuthUser;
pub use routes::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/register", post(routes::register))
        .route("/login", post(routes::login))
        .route("/otp/request", post(routes::request_otp))
        .route("/otp/verify", post(routes::verify_otp))
        .route("/refresh", post(routes::refresh))
        .route("/logout", post(routes::logout))
        .route("/logout-others", post(routes::logout_other_sessions))
        .route("/sessions", get(routes::list_my_sessions))
        .route("/sessions/{session_id}", delete(routes::revoke_my_session))
        .with_state(state)
}
