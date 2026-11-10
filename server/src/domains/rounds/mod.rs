pub mod allocation;
pub mod db;
pub mod models;
pub mod routes;

use axum::{
    Router,
    routing::{get, post, put},
};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/", get(routes::list_rounds).post(routes::create_round))
        .route("/open", get(routes::list_open_rounds))
        .route(
            "/{id}",
            get(routes::get_round)
                .patch(routes::update_round)
                .delete(routes::delete_round),
        )
        .route("/{id}/priorities", put(routes::set_priorities))
        .route("/{id}/applications", get(routes::list_applications))
        .route("/{id}/allocate", post(routes::allocate_round))
        .route(
            "/{id}/allocation",
            get(routes::get_allocation).put(routes::save_allocation),
        )
        .route("/{id}/complete", post(routes::complete_round))
        .with_state(state)
}
