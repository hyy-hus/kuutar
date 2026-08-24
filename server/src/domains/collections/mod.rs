pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_collections).post(routes::create_collection),
        )
        .route(
            "/{id}",
            get(routes::get_collection)
                .patch(routes::update_collection)
                .delete(routes::delete_collection),
        )
        .with_state(state)
}
