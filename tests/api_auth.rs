use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use kuutar::app;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

mod common;

use common::test_config;

/// Helper to seed a test group into the DB since registration requires a valid group_id
async fn create_test_group(pool: &PgPool) -> Uuid {
    let group_id = Uuid::new_v4();
    sqlx::query("INSERT INTO groups (id, name) VALUES ($1, $2)")
        .bind(group_id)
        .bind("Test Group")
        .execute(pool)
        .await
        .expect("Failed to insert test group");
    group_id
}

#[sqlx::test]
async fn test_auth_full_lifecycle(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let group_id = create_test_group(&pool).await;

    // 1. REGISTER
    let req = Request::builder()
        .method("POST")
        .uri("/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "group_id": group_id,
                "email": "  user@example.com  ", // Tests custom trim deserializer
                "password": "securepassword123"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let register_res: Value = serde_json::from_slice(&body).unwrap();

    assert!(register_res["access_token"].as_str().is_some());
    assert!(register_res["refresh_token"].as_str().is_some());
    assert_eq!(register_res["token_type"], "Bearer");

    // 2. LOGIN
    let req = Request::builder()
        .method("POST")
        .uri("/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": "user@example.com",
                "password": "securepassword123"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let login_res: Value = serde_json::from_slice(&body).unwrap();
    let refresh_token_1 = login_res["refresh_token"].as_str().unwrap().to_string();

    // 3. REFRESH TOKEN (Rotation test)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "refresh_token": refresh_token_1
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let refresh_res: Value = serde_json::from_slice(&body).unwrap();
    let refresh_token_2 = refresh_res["refresh_token"].as_str().unwrap().to_string();

    // Verify token was rotated
    assert_ne!(refresh_token_1, refresh_token_2);

    // 4. ATTEMPT REUSING CONSUMED REFRESH TOKEN (401)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "refresh_token": refresh_token_1
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 5. LOGOUT (Revoke current refresh token)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/logout")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "refresh_token": refresh_token_2
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 6. ATTEMPT REFRESH AFTER LOGOUT (401)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "refresh_token": refresh_token_2
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_auth_error_handling(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let group_id = create_test_group(&pool).await;

    // 1. Validation Error: Password Too Short (422)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "group_id": group_id,
                "email": "user@example.com",
                "password": "123" // < 8 characters
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 2. Validation Error: Invalid Email Format (422)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "group_id": group_id,
                "email": "not-an-email",
                "password": "validpassword123"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // 3. Login Error: Non-existent User (401)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": "nobody@example.com",
                "password": "password123"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 4. Register a valid user for password tests
    let req = Request::builder()
        .method("POST")
        .uri("/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "group_id": group_id,
                "email": "valid@example.com",
                "password": "correctpassword123"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    // 5. Login Error: Wrong Password (401)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": "valid@example.com",
                "password": "wrongpassword"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 6. Refresh Error: Unknown Refresh Token (401)
    let req = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "refresh_token": "nonexistent_token_string"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}
