use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use kuutar::app;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

#[sqlx::test]
async fn test_collections_crud_lifecycle(pool: PgPool) {
    let app = app(pool);

    // 1. LIST (Starts Empty)
    let req = Request::builder()
        .method("GET")
        .uri("/collections")
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
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "name": "  Project Alpha  " }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let collection: Value = serde_json::from_slice(&body).unwrap();
    let col_id = collection["id"].as_str().unwrap();
    // Verify custom Serde trimming worked
    assert_eq!(collection["name"], "Project Alpha");

    // 3. GET BY ID
    let req = Request::builder()
        .method("GET")
        .uri(format!("/collections/{}", col_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 4. PATCH (UPDATE NAME)
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/collections/{}", col_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "name": "Project Alpha (Updated)" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. DELETE (SOFT DELETE)
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/collections/{}", col_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 6. VERIFY SOFT DELETED ITEM RETURNS 404
    let req = Request::builder()
        .method("GET")
        .uri(format!("/collections/{}", col_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_collections_error_handling(pool: PgPool) {
    let app = app(pool);

    // 1. Validation Error: Empty Name (422)
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 2. Not Found Error: Unknown UUID (404)
    let req = Request::builder()
        .method("GET")
        .uri("/collections/00000000-0000-0000-0000-000000000001")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Delete Non-Existent ID (404)
    let req = Request::builder()
        .method("DELETE")
        .uri("/collections/00000000-0000-0000-0000-000000000001")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
