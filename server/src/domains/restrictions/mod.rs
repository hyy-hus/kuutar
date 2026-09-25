pub mod db;
pub mod models;
pub mod routes;

use axum::{
    Router,
    routing::{get, post},
};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route(
            "/",
            get(routes::list_restrictions).post(routes::create_restriction),
        )
        .route(
            "/{id}",
            get(routes::get_restriction)
                .patch(routes::update_restriction)
                .delete(routes::delete_restriction),
        )
        .with_state(state)
}
