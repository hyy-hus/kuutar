pub mod db;
pub mod models;
pub mod routes;

use axum::{
    Router,
    routing::{delete, get},
};

use crate::domains::auth::AuthState;

pub fn router(state: AuthState) -> Router {
    Router::new()
        .route("/", get(routes::list_users).post(routes::create_user))
        .route(
            "/me",
            get(routes::get_me)
                .patch(routes::update_me)
                .delete(routes::delete_me),
        )
        .route(
            "/{id}",
            get(routes::get_user)
                .patch(routes::update_user)
                .delete(routes::delete_user),
        )
        .route(
            "/{id}/sessions",
            get(routes::list_user_sessions).delete(routes::revoke_user_sessions),
        )
        .route(
            "/{id}/sessions/{session_id}",
            delete(routes::revoke_user_session),
        )
        .with_state(state)
}
