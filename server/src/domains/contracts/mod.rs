pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_contracts).post(routes::create_contract),
        )
        .route(
            "/_{id}",
            get(routes::get_contract)
                .patch(routes::update_contract)
                .delete(routes::delete_contract),
        )
        .with_state(state)
}
