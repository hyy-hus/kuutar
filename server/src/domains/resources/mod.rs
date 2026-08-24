pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_resources).post(routes::create_resource),
        )
        .route(
            "/{id}",
            get(routes::get_resource)
                .patch(routes::update_resource)
                .delete(routes::delete_resource),
        )
        .with_state(state)
}
