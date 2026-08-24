use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use kuutar::app;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

mod common;
use common::{setup_admin_token, test_config};

/// Helper to create a parent collection for resource tests using admin auth
async fn create_test_collection(app: &axum::Router, admin_auth: &str) -> String {
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, admin_auth)
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
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;
    let col_id = create_test_collection(&app, &admin_auth).await;

    // 1. LIST RESOURCES - Public
    let req = Request::builder()
        .method("GET")
        .uri("/resources")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. UNAUTHENTICATED CREATE RESOURCE -> 401 UNAUTHORIZED
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Unauthorized Widget" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 3. CREATE RESOURCE (AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Widget Alpha" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let resource: Value = serde_json::from_slice(&body).unwrap();
    let res_id = resource["id"].as_str().unwrap();

    // 4. GET BY ID - Public
    let req = Request::builder()
        .method("GET")
        .uri(format!("/resources/{}", res_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. PATCH (UPDATE RESOURCE - AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/resources/{}", res_id))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "Widget Beta" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 6. DELETE (SOFT DELETE - AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/resources/{}", res_id))
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 7. VERIFY SOFT DELETED ITEM RETURNS 404
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
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;
    let col_id = create_test_collection(&app, &admin_auth).await;

    // Create Initial Resource
    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
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
        .header(header::AUTHORIZATION, &admin_auth)
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
        .header(header::AUTHORIZATION, &admin_auth)
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
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "New Name" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
