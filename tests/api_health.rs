use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use kuutar::app;
use sqlx::PgPool;
use tower::ServiceExt;

#[sqlx::test]
async fn test_health_check_endpoint(pool: PgPool) {
    let app = app(pool);

    let req = Request::builder()
        .method("GET")
        .uri("/health")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}
