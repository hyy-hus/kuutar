use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Resource not found")]
    NotFound,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    ValidationError(#[from] validator::ValidationErrors),

    #[error("Database error")]
    Database(sqlx::Error),

    #[error("Internal Server Error: {0}")]
    InternalServerError(String),
}

// Convert SQLx errors into domain-aware AppError
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound,
            sqlx::Error::Database(ref db_err) => {
                match db_err.code().as_deref() {
                    // HTTP 409 Conflict - Unique Constraint Violations
                    Some("23505") => {
                        let message = match db_err.constraint() {
                            Some("idx_users_unique_active_email") => {
                                "A user with this email already exists."
                            }
                            Some("idx_groups_unique_active_name") => {
                                "A group with this name already exists."
                            }
                            Some("idx_collections_unique_active_name") => {
                                "A collection with this name already exists."
                            }
                            Some("idx_resources_unique_active_name_per_collection") => {
                                "A resource with this name already exists in this collection."
                            }
                            _ => "A resource with this identifier already exists.",
                        };
                        AppError::Conflict(message.to_string())
                    }

                    // HTTP 400 Bad Request - Foreign Key Violations
                    Some("23503") => {
                        let message = match db_err.constraint() {
                            Some("users_group_id_fkey") => "The specified group does not exist.",
                            Some("resources_collection_id_fkey") => {
                                "The specified collection does not exist."
                            }
                            _ => "Referenced entity does not exist.",
                        };
                        AppError::BadRequest(message.to_string())
                    }

                    _ => AppError::Database(err),
                }
            }
            _ => AppError::Database(err),
        }
    }
}

// Convert AppError into Axum HTTP JSON Responses
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::BadRequest(ref msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Unauthorized(ref msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            AppError::Forbidden(ref msg) => (StatusCode::FORBIDDEN, msg.clone()),
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Conflict(ref msg) => (StatusCode::CONFLICT, msg.clone()),

            AppError::ValidationError(ref errs) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("Invalid request body: {}", errs),
            ),

            AppError::Database(ref err) => {
                tracing::error!("Unhandled Database Error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal database error occurred.".to_string(),
                )
            }

            AppError::InternalServerError(ref err) => {
                tracing::error!("Unhandled Internal Server Error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal error occurred.".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": error_message }))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use serde_json::Value;
    use validator::ValidationErrors;

    /// Mock DatabaseError to test custom SQL constraint paths without a live Postgres connection
    #[derive(Debug)]
    struct MockDbError {
        code: &'static str,
        constraint: Option<&'static str>,
    }

    impl std::fmt::Display for MockDbError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "Mock DB Error")
        }
    }

    impl std::error::Error for MockDbError {}

    impl sqlx::error::DatabaseError for MockDbError {
        fn message(&self) -> &str {
            "Mock DB Error"
        }

        fn kind(&self) -> sqlx::error::ErrorKind {
            sqlx::error::ErrorKind::Other
        }

        fn code(&self) -> Option<std::borrow::Cow<'_, str>> {
            Some(self.code.into())
        }

        fn constraint(&self) -> Option<&str> {
            self.constraint
        }

        fn as_error(&self) -> &(dyn std::error::Error + Send + Sync + 'static) {
            self
        }

        fn as_error_mut(&mut self) -> &mut (dyn std::error::Error + Send + Sync + 'static) {
            self
        }

        fn into_error(self: Box<Self>) -> Box<dyn std::error::Error + Send + Sync + 'static> {
            self
        }
    }

    #[tokio::test]
    async fn test_into_response_bad_request() {
        let err = AppError::BadRequest("Invalid payload field".to_string());
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "Invalid payload field");
    }

    #[tokio::test]
    async fn test_into_response_not_found() {
        let err = AppError::NotFound;
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::NOT_FOUND);

        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "Resource not found");
    }

    #[tokio::test]
    async fn test_into_response_conflict() {
        let err = AppError::Conflict("Resource conflict".to_string());
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::CONFLICT);

        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "Resource conflict");
    }

    #[tokio::test]
    async fn test_into_response_validation_error() {
        let errs = ValidationErrors::new();
        let err = AppError::ValidationError(errs);
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert!(
            json["error"]
                .as_str()
                .unwrap()
                .starts_with("Invalid request body:")
        );
    }

    #[tokio::test]
    async fn test_into_response_database_error() {
        let err = AppError::Database(sqlx::Error::PoolTimedOut);
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "An internal database error occurred.");
    }

    #[test]
    fn test_from_sqlx_row_not_found() {
        let app_err: AppError = sqlx::Error::RowNotFound.into();
        assert!(matches!(app_err, AppError::NotFound));
    }

    #[test]
    fn test_from_sqlx_error_user_unique_email() {
        let db_err = MockDbError {
            code: "23505",
            constraint: Some("idx_users_unique_active_email"),
        };
        let app_err: AppError = sqlx::Error::Database(Box::new(db_err)).into();

        if let AppError::Conflict(msg) = app_err {
            assert_eq!(msg, "A user with this email already exists.");
        } else {
            panic!("Expected AppError::Conflict");
        }
    }

    #[test]
    fn test_from_sqlx_error_foreign_key_user_group() {
        let db_err = MockDbError {
            code: "23503",
            constraint: Some("users_group_id_fkey"),
        };
        let app_err: AppError = sqlx::Error::Database(Box::new(db_err)).into();

        if let AppError::BadRequest(msg) = app_err {
            assert_eq!(msg, "The specified group does not exist.");
        } else {
            panic!("Expected AppError::BadRequest");
        }
    }
}
