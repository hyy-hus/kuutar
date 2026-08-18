pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};
use sqlx::PgPool;

pub fn router(pool: PgPool) -> Router {
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
        .with_state(pool)
}
