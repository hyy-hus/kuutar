pub mod db;
pub mod models;
pub mod routes;

use crate::domains::auth::AuthState;
use axum::{
    Router,
    routing::{get, post},
};

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_reservations).post(routes::create_reservation),
        )
        .route("/me", get(routes::list_my_reservations))
        .route(
            "/check-conflicts",
            post(routes::check_reservation_conflicts),
        )
        .route(
            "/{id}",
            get(routes::get_reservation)
                .patch(routes::update_reservation)
                .delete(routes::delete_reservation),
        )
        .with_state(state)
}
