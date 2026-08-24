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
async fn test_groups_crud_lifecycle(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;

    // 1. LIST (Check initial count)
    let req = Request::builder()
        .method("GET")
        .uri("/groups")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let initial_list: Vec<Value> = serde_json::from_slice(&body).unwrap();
    let initial_count = initial_list.len();

    // 2. CREATE
    let req = Request::builder()
        .method("POST")
        .uri("/groups")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "  DevOps Team  " }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let group: Value = serde_json::from_slice(&body).unwrap();
    let group_id = group["id"].as_str().unwrap();

    // Verify count increased by 1
    let req = Request::builder()
        .method("GET")
        .uri("/groups")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let updated_list: Vec<Value> = serde_json::from_slice(&body).unwrap();
    assert_eq!(updated_list.len(), initial_count + 1);

    // 3. GET BY ID - Requires Auth Header
    let req = Request::builder()
        .method("GET")
        .uri(format!("/groups/{}", group_id))
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 4. PATCH (UPDATE NAME) - Requires Admin Auth
    let req = Request::builder()
        .method("PATCH")
        .uri(format!("/groups/{}", group_id))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(
            json!({ "name": "DevOps Team Lead" }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. DELETE (SOFT DELETE) - Requires Admin Auth
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/groups/{}", group_id))
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 6. VERIFY SOFT DELETED ITEM RETURNS 404
    let req = Request::builder()
        .method("GET")
        .uri(format!("/groups/{}", group_id))
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_groups_error_handling(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let admin_auth = setup_admin_token(&pool).await;

    // 1. Validation Error: Empty Name (422)
    let req = Request::builder()
        .method("POST")
        .uri("/groups")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 2. Not Found Error: Get Non-Existent ID (404)
    let req = Request::builder()
        .method("GET")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Not Found Error: Patch Non-Existent ID (404)
    let req = Request::builder()
        .method("PATCH")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::from(json!({ "name": "Valid Name" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 4. Not Found Error: Delete Non-Existent ID (404)
    let req = Request::builder()
        .method("DELETE")
        .uri("/groups/00000000-0000-0000-0000-000000000001")
        .header(header::AUTHORIZATION, &admin_auth)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
