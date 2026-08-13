use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Resource not found")]
    NotFound,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    ValidationError(#[from] validator::ValidationErrors),

    #[error("Database error")]
    Database(sqlx::Error),
}

// Convert SQLx errors into AppError
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(ref db_err) = err {
            if db_err.code().as_deref() == Some("23505") {
                let message = match db_err.constraint() {
                    Some("idx_collections_unique_active_name") => {
                        "A collection with this name already exists."
                    }
                    Some("idx_resources_unique_active_name_per_collection") => {
                        "A resource with this name already exists in this collection."
                    }
                    _ => "A resource with this name already exists.",
                };

                return AppError::Conflict(message.to_string());
            }
        }

        AppError::Database(err)
    }
}

// Convert AppError into Axum HTTP Responses
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),

            // HTTP 409 Conflict
            AppError::Conflict(ref msg) => (StatusCode::CONFLICT, msg.clone()),

            // HTTP 422 Unprocessable Entity
            AppError::ValidationError(ref errs) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("Invalid request body: {}", errs),
            ),

            // HTTP 500 Internal Server Error
            AppError::Database(ref err) => {
                tracing::error!("Unhandled Database Error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal database error occurred.".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": error_message }))).into_response()
    }
}
