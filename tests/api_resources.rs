use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

use kuutar::app;

#[sqlx::test]
async fn test_create_and_get_collection_and_resource(pool: PgPool) {
    let app = app(pool);

    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .body(Body::from(json!({ "name": "Test Collection" }).to_string()))
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let collection: Value = serde_json::from_slice(&body).unwrap();
    let collection_id = collection["id"].as_str().unwrap();

    let req = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .body(Body::from(
            json!({
                "collection_id": collection_id,
                "name": "Test Resource"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let resource: Value = serde_json::from_slice(&body).unwrap();
    let resource_id = resource["id"].as_str().unwrap();

    let req = Request::builder()
        .method("GET")
        .uri(format!("/resources/{}", resource_id))
        .body(Body::empty())
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[sqlx::test]
async fn test_duplicate_resource_name_returns_conflict(pool: PgPool) {
    let app = app(pool);

    let req = Request::builder()
        .method("POST")
        .uri("/collections")
        .header(header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .body(Body::from(json!({ "name": "Col 1" }).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let col: Value = serde_json::from_slice(&body).unwrap();
    let col_id = col["id"].as_str().unwrap();

    let req1 = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Shared Name" }).to_string(),
        ))
        .unwrap();
    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::CREATED);

    let req2 = Request::builder()
        .method("POST")
        .uri("/resources")
        .header(header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .body(Body::from(
            json!({ "collection_id": col_id, "name": "Shared Name" }).to_string(),
        ))
        .unwrap();
    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::CONFLICT);
}
