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

#[sqlx::test]
async fn test_collections_crud_lifecycle(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;

    // 1. LIST (Starts Empty) - Public
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

    // 2. UNAUTHENTICATED CREATE (Fails with 401)
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "name": "Unauthorized Project" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 3. CREATE (AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
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

    // 4. GET BY ID - Public
    let req = Request::builder()
        .method("GET")
        .uri(format!("/collections/{}", col_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. PATCH (UPDATE NAME - AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/collections/{}", col_id))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(
            json!({ "name": "Project Alpha (Updated)" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 6. DELETE (SOFT DELETE - AUTHENTICATED ADMIN)
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/collections/{}", col_id))
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 7. VERIFY SOFT DELETED ITEM RETURNS 404
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
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;

    // 1. Validation Error: Empty Name (422) - Admin Auth provided
    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 2. Not Found Error: Unknown UUID (404) - Public GET
    let req = Request::builder()
        .method("GET")
        .uri("/collections/00000000-0000-0000-0000-000000000001")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Delete Non-Existent ID (404) - Admin Auth provided
    let req = Request::builder()
        .method("DELETE")
        .uri("/collections/00000000-0000-0000-0000-000000000001")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
