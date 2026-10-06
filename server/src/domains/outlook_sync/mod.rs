pub mod graph;
pub mod ical;
pub mod importer;
pub mod models;
pub mod poller;
pub mod routes;

use axum::{
    Router,
    routing::{get, post},
};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/status", get(routes::get_status))
        .route("/run", post(routes::run_sync))
        .with_state(state)
}
