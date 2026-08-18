// tests/api_reservations.rs

mod common;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use common::test_config;
use kuutar::{
    app,
    domains::{auth::jwt::encode_jwt, users::models::Role},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

/// Helper to seed group, collection, resource, user, and valid JWT
async fn setup_test_environment(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, String) {
    let config = test_config();

    let group = sqlx::query!(
        "INSERT INTO groups (name) VALUES ($1) RETURNING id",
        format!("Test Group {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let collection = sqlx::query!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let resource = sqlx::query!(
        "INSERT INTO resources (collection_id, name) VALUES ($1, $2) RETURNING id",
        collection.id,
        format!("Resource {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let user = sqlx::query!(
        r#"
        INSERT INTO users (group_id, email, password_hash, role)
        VALUES ($1, $2, $3, 'user'::user_role)
        RETURNING id, role AS "role: Role"
        "#,
        group.id,
        format!("user_{}@example.com", Uuid::new_v4()),
        "fake_hash"
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let token = encode_jwt(
        user.id,
        group.id,
        user.role,
        &config.jwt_secret,
        config.jwt_expiration_seconds,
    )
    .unwrap();

    (group.id, user.id, resource.id, collection.id, token)
}

#[sqlx::test]
async fn test_create_and_get_reservation(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool).await;
    let app = app(pool, test_config());

    let now = Utc::now();
    let start_time = now + Duration::hours(1);
    let end_time = now + Duration::hours(2);

    let payload = json!({
        "title": "Team Sync",
        "description": "Weekly alignment meeting",
        "rrule": "FREQ=WEEKLY;COUNT=1",
        "status": "confirmed",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": start_time,
                "end_time": end_time
            }
        ]
    });

    // 1. Create reservation
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations")
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

    let reservation_id = json["id"].as_str().unwrap();
    assert_eq!(json["title"], "Team Sync");
    assert_eq!(json["status"], "confirmed");
    assert_eq!(json["occurrences"].as_array().unwrap().len(), 1);

    // 2. Get reservation details by ID
    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/reservations/{reservation_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);
}

#[sqlx::test]
async fn test_check_reservation_conflicts(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool).await;
    let app = app(pool, test_config());

    let base_time = Utc::now() + Duration::hours(10);
    let start_time = base_time;
    let end_time = base_time + Duration::hours(1);

    // Create an existing reservation from 10:00 to 11:00
    let payload = json!({
        "title": "Existing Booking",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": start_time,
                "end_time": end_time
            }
        ]
    });

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_res.status(), StatusCode::CREATED);

    // Test 1: Proposed booking starting at 11:00 (back-to-back half-open interval, NO conflict)
    let non_conflicting_payload = json!([
        {
            "resource_id": resource_id,
            "start_time": end_time,
            "end_time": end_time + Duration::hours(1)
        }
    ]);

    let check_res1 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations/check-conflicts")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(non_conflicting_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(check_res1.status(), StatusCode::OK);
    let body1 = to_bytes(check_res1.into_body(), usize::MAX).await.unwrap();
    let conflicts1: Value = serde_json::from_slice(&body1).unwrap();
    assert_eq!(conflicts1.as_array().unwrap().len(), 0);

    // Test 2: Proposed booking overlapping 10:30 to 11:30 (CONFLICT expected)
    let conflicting_payload = json!([
        {
            "resource_id": resource_id,
            "start_time": start_time + Duration::minutes(30),
            "end_time": end_time + Duration::minutes(30)
        }
    ]);

    let check_res2 = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations/check-conflicts")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(conflicting_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(check_res2.status(), StatusCode::OK);
    let body2 = to_bytes(check_res2.into_body(), usize::MAX).await.unwrap();
    let conflicts2: Value = serde_json::from_slice(&body2).unwrap();
    assert_eq!(conflicts2.as_array().unwrap().len(), 1);
}

#[sqlx::test]
async fn test_soft_delete_reservation(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool).await;
    let app = app(pool.clone(), test_config());

    let now = Utc::now();
    let payload = json!({
        "title": "To Be Deleted",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": now + Duration::hours(1),
                "end_time": now + Duration::hours(2)
            }
        ]
    });

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = to_bytes(create_res.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let reservation_id = json["id"].as_str().unwrap();

    // Delete the reservation
    let delete_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/reservations/{reservation_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(delete_res.status(), StatusCode::NO_CONTENT);

    // Verify soft-deleted in DB
    let db_record = sqlx::query!(
        "SELECT deleted_at FROM reservations WHERE id = $1",
        Uuid::parse_str(reservation_id).unwrap()
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(db_record.deleted_at.is_some());

    // Verify GET returns 404
    let get_res = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/reservations/{reservation_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_list_and_update_reservation(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool).await;
    let app = app(pool, test_config());

    let now = Utc::now();

    // 1. Create a reservation
    let payload = json!({
        "title": "Initial Title",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": now + Duration::hours(1),
                "end_time": now + Duration::hours(2)
            }
        ]
    });

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = to_bytes(create_res.into_body(), usize::MAX).await.unwrap();
    let created_json: Value = serde_json::from_slice(&body).unwrap();
    let reservation_id = created_json["id"].as_str().unwrap();

    // 2. Test GET /reservations (list)
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/reservations")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(list_res.status(), StatusCode::OK);

    // 3. Test PATCH /reservations/{id}
    let update_payload = json!({
        "title": "Updated Title",
        "status": "confirmed"
    });

    let patch_res = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/reservations/{reservation_id}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(update_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(patch_res.status(), StatusCode::OK);
    let patch_body = to_bytes(patch_res.into_body(), usize::MAX).await.unwrap();
    let updated_json: Value = serde_json::from_slice(&patch_body).unwrap();
    assert_eq!(updated_json["title"], "Updated Title");
    assert_eq!(updated_json["status"], "confirmed");
}

#[sqlx::test]
async fn test_create_reservation_invalid_times(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool).await;
    let app = app(pool, test_config());

    let now = Utc::now();
    // Inverted times: start_time is AFTER end_time
    let payload = json!({
        "title": "Broken Time Reservation",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": now + Duration::hours(2),
                "end_time": now + Duration::hours(1)
            }
        ]
    });

    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/reservations")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}
