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

use common::test_config;

#[sqlx::test]
async fn test_groups_crud_lifecycle(pool: PgPool) {
    let app = app(pool, test_config());

    // 1. LIST (Starts Empty)
    let req = Request::builder()
        .method("GET")
        .uri("/groups")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let list: Vec<Value> = serde_json::from_slice(&body).unwrap();
    assert_eq!(list.len(), 0);

    // 2. CREATE
    let req = Request::builder()
        .method("POST")
        .uri("/groups")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "  DevOps Team  " }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let group: Value = serde_json::from_slice(&body).unwrap();
    let group_id = group["id"].as_str().unwrap();

    // 3. GET BY ID
    let req = Request::builder()
        .method("GET")
        .uri(format!("/groups/{}", group_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 4. PATCH (UPDATE NAME)
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/groups/{}", group_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "name": "DevOps Team Lead" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. DELETE (SOFT DELETE)
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/groups/{}", group_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 6. VERIFY SOFT DELETED ITEM RETURNS 404
    let req = Request::builder()
        .method("GET")
        .uri(format!("/groups/{}", group_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_groups_error_handling(pool: PgPool) {
    let app = app(pool, test_config());

    // 1. Validation Error: Empty Name (422)
    let req = Request::builder()
        .method("POST")
        .uri("/groups")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 2. Not Found Error: Get Non-Existent ID (404)
    let req = Request::builder()
        .method("GET")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Not Found Error: Patch Non-Existent ID (404)
    let req = Request::builder()
        .method("PATCH")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "Valid Name" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 4. Not Found Error: Delete Non-Existent ID (404)
    let req = Request::builder()
        .method("DELETE")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
