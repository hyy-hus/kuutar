pub mod db;
pub mod defaults;
pub mod models;
pub mod notify;
pub mod render;
pub mod routes;

use axum::{
    Router,
    routing::{get, post},
};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/", get(routes::list_templates))
        .route(
            "/{key}",
            get(routes::get_template)
                .put(routes::update_template)
                .delete(routes::reset_template),
        )
        .route("/{key}/preview", post(routes::preview_template))
        .route("/{key}/send-test", post(routes::send_test))
        .with_state(state)
}
