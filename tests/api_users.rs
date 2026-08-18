// tests/api_users.rs

mod common;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use common::test_config;
use kuutar::{app, domains::auth::jwt::encode_jwt};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

/// Helper to seed a test group, a user, and generate a valid JWT access token
async fn setup_authenticated_user(pool: &PgPool) -> (Uuid, Uuid, String) {
    let config = test_config();

    let group = sqlx::query!(
        "INSERT INTO groups (name) VALUES ($1) RETURNING id",
        format!("Test Group {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let user = sqlx::query!(
        "INSERT INTO users (group_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        group.id,
        format!("user_{}@example.com", Uuid::new_v4()),
        "fake_hashed_password"
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let token = encode_jwt(
        user.id,
        group.id,
        &config.jwt_secret,
        config.jwt_expiration_seconds,
    )
    .unwrap();

    (user.id, group.id, token)
}

#[sqlx::test]
async fn test_get_me_success(pool: PgPool) {
    let (user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/users/me")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["id"], user_id.to_string());
}

#[sqlx::test]
async fn test_get_me_unauthorized_without_token(pool: PgPool) {
    let app = app(pool, test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/users/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_list_users(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/users")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json.as_array().unwrap().len() >= 1);
}

#[sqlx::test]
async fn test_create_user(pool: PgPool) {
    let (_user_id, group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let payload = json!({
        "group_id": group_id,
        "email": "new_created_user@example.com",
        "password": "Password123!"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/users")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["email"], "new_created_user@example.com");
}

#[sqlx::test]
async fn test_update_me(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let payload = json!({
        "email": "updated_my_email@example.com"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/users/me")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["email"], "updated_my_email@example.com");
}

#[sqlx::test]
async fn test_delete_me(pool: PgPool) {
    let (user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool.clone(), test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/users/me")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Verify user is soft-deleted in database
    let deleted_user = sqlx::query!("SELECT deleted_at FROM users WHERE id = $1", user_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert!(deleted_user.deleted_at.is_some());
}

// Append to tests/api_users.rs

#[sqlx::test]
async fn test_get_user_by_id_success(pool: PgPool) {
    let (user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/users/{user_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["id"], user_id.to_string());
}

#[sqlx::test]
async fn test_get_user_by_id_not_found(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());
    let missing_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/users/{missing_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_update_user_by_id_success(pool: PgPool) {
    let (user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let payload = json!({
        "email": "updated_by_id@example.com"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/users/{user_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["email"], "updated_by_id@example.com");
}

#[sqlx::test]
async fn test_update_user_by_id_not_found(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());
    let missing_id = Uuid::new_v4();

    let payload = json!({
        "email": "ghost@example.com"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/users/{missing_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_delete_user_by_id_success(pool: PgPool) {
    let (_admin_id, group_id, token) = setup_authenticated_user(&pool).await;

    // Create a target user to delete
    let target_user = sqlx::query!(
        "INSERT INTO users (group_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        group_id,
        "to_be_deleted@example.com",
        "hash"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let app = app(pool.clone(), test_config());

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/users/{}", target_user.id))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let db_record = sqlx::query!("SELECT deleted_at FROM users WHERE id = $1", target_user.id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert!(db_record.deleted_at.is_some());
}

#[sqlx::test]
async fn test_delete_user_by_id_not_found(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());
    let missing_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/users/{missing_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_create_user_validation_error(pool: PgPool) {
    let (_user_id, group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let payload = json!({
        "group_id": group_id,
        "email": "invalid-email-format",
        "password": "short"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/users")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[sqlx::test]
async fn test_create_user_non_existent_group(pool: PgPool) {
    let (_user_id, _group_id, token) = setup_authenticated_user(&pool).await;
    let app = app(pool, test_config());

    let payload = json!({
        "group_id": Uuid::new_v4(),
        "email": "valid_email@example.com",
        "password": "ValidPassword123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/users")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
