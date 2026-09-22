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
            get(routes::list_contracts).post(routes::create_contract),
        )
        .route("/presign-upload", post(routes::generate_upload_url))
        .route("/download", get(routes::generate_download_url))
        .route("/static/{s3_key}", get(routes::static_contract))
        .route(
            "/{id}",
            get(routes::get_contract)
                .patch(routes::update_contract)
                .delete(routes::delete_contract),
        )
        .with_state(state)
}
