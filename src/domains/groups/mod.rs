pub mod db;
pub mod models;
pub mod routes;

use axum::{Router, routing::get};
use sqlx::PgPool;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/", get(routes::list_groups).post(routes::create_group))
        .route(
            "/{id}",
            get(routes::get_group)
                .patch(routes::update_group)
                .delete(routes::delete_group),
        )
        .with_state(pool)
}
