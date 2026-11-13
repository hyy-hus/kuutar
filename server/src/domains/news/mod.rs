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
        .route("/", get(routes::list_news).post(routes::create_news))
        .route("/highlights", get(routes::list_highlights))
        .route("/unread-count", get(routes::unread_count))
        .route("/read-all", post(routes::mark_all_read))
        .route(
            "/{id}",
            get(routes::get_news)
                .put(routes::update_news)
                .delete(routes::delete_news),
        )
        .route("/{id}/read", post(routes::mark_read))
        .with_state(state)
}
