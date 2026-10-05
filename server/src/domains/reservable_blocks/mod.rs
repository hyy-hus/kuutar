pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_reservable_blocks).post(routes::create_reservable_block),
        )
        .route(
            "/{id}",
            get(routes::get_reservable_block)
                .patch(routes::update_reservable_block)
                .delete(routes::delete_reservable_block),
        )
        .with_state(state)
}
