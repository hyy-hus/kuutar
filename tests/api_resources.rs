use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use kuutar::app;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

/// Helper to create a parent collection for resource tests
async fn create_test_collection(app: &axum::Router) -> String {
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "name": "Parent Collection" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let col: Value = serde_json::from_slice(&body).unwrap();
    col["id"].as_str().unwrap().to_string()
}

#[sqlx::test]
async fn test_resources_crud_lifecycle(pool: PgPool) {
    let app = app(pool);
    let col_id = create_test_collection(&app).await;

    // 1. LIST RESOURCES
    let req = Request::builder()
        .method("GET")
        .uri("/resources")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. CREATE RESOURCE
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Widget Alpha" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let resource: Value = serde_json::from_slice(&body).unwrap();
    let res_id = resource["id"].as_str().unwrap();

    // 3. GET BY ID
    let req = Request::builder()
        .method("GET")
        .uri(format!("/resources/{}", res_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 4. PATCH (UPDATE RESOURCE)
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/resources/{}", res_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "Widget Beta" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. DELETE (SOFT DELETE)
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/resources/{}", res_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 6. VERIFY SOFT DELETED ITEM RETURNS 404
    let req = Request::builder()
        .method("GET")
        .uri(format!("/resources/{}", res_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_resources_duplicate_conflict_and_validation(pool: PgPool) {
    let app = app(pool);
    let col_id = create_test_collection(&app).await;

    // Create Initial Resource
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Unique Name" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    // Duplicate Creation -> 409 CONFLICT
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Unique Name" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);

    // Empty Name Validation Failure -> 422
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // Update Non-Existent Resource -> 404 NOT FOUND
    let req = Request::builder()
        .method("PATCH")
        .uri("/resources/00000000-0000-0000-0000-000000000001")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "New Name" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
