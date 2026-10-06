mod common;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use common::{setup_user_token, test_config};
use kuutar::{app, domains::users::models::Role};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

/// Helper to seed group, collection, a recurrence-enabled resource, a user with
/// the given role, and a valid JWT
async fn setup_test_environment(pool: &PgPool, role: Role) -> (Uuid, Uuid, Uuid, Uuid, String) {
    let (auth_header, user_id, group_id) = setup_user_token(pool, role).await;

    // Strip "Bearer " prefix for tests that format it manually
    let token = auth_header.trim_start_matches("Bearer ").to_string();

    let collection = sqlx::query!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let resource = sqlx::query!(
        "INSERT INTO resources (collection_id, name, allow_recurring) VALUES ($1, $2, TRUE) RETURNING id",
        collection.id,
        format!("Resource {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    (group_id, user_id, resource.id, collection.id, token)
}

#[sqlx::test]
async fn test_create_and_get_reservation(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool, Role::User).await;
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

    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();

    if status != StatusCode::CREATED {
        eprintln!("SERVER ERROR BODY: {}", String::from_utf8_lossy(&body));
    }

    assert_eq!(status, StatusCode::CREATED);

    let json: Value = serde_json::from_slice(&body).unwrap();

    let reservation_id = json["id"].as_str().unwrap();
    assert_eq!(json["title"], "Team Sync");
    // Reservations by regular users always start as pending, even if "confirmed" is requested
    assert_eq!(json["status"], "pending");
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
        setup_test_environment(&pool, Role::Admin).await;
    let app = app(pool, test_config());

    let base_time = Utc::now() + Duration::hours(10);
    let start_time = base_time;
    let end_time = base_time + Duration::hours(1);

    // Create an existing reservation from 10:00 to 11:00. Only confirmed
    // reservations count as conflicts, and only admins can create them confirmed.
    let payload = json!({
        "title": "Existing Booking",
        "status": "confirmed",
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
        setup_test_environment(&pool, Role::Admin).await;
    let app = app(pool.clone(), test_config());

    let now = Utc::now();
    let payload = json!({
        "title": "To Be Deleted",
        "status": "confirmed",
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
    let reservation_id = json["id"]
        .as_str()
        .expect("Response should contain reservation id");

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
        setup_test_environment(&pool, Role::User).await;
    let app = app(pool, test_config());

    let now = Utc::now();

    // 1. Create a reservation
    let payload = json!({
        "title": "Initial Title",
        "status": "pending",
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
    let reservation_id = created_json["id"]
        .as_str()
        .expect("Response should contain reservation id");

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
    // Edits by regular users need re-approval, so the requested "confirmed" is ignored
    assert_eq!(updated_json["status"], "pending");
}

#[sqlx::test]
async fn test_create_reservation_invalid_times(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool, Role::User).await;
    let app = app(pool, test_config());

    let now = Utc::now();
    // Inverted times: start_time is AFTER end_time
    let payload = json!({
        "title": "Broken Time Reservation",
        "status": "confirmed",
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

#[sqlx::test]
async fn test_recurring_reservation_forbidden_on_non_recurring_resource(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool, Role::User).await;

    sqlx::query!(
        "UPDATE resources SET allow_recurring = FALSE WHERE id = $1",
        resource_id
    )
    .execute(&pool)
    .await
    .unwrap();

    let app = app(pool, test_config());
    let now = Utc::now();
    let payload = json!({
        "title": "Weekly Sauna",
        "rrule": "FREQ=WEEKLY;COUNT=2",
        "occurrences": [
            {
                "resource_id": resource_id,
                "start_time": now + Duration::hours(1),
                "end_time": now + Duration::hours(2)
            }
        ]
    });

    let response = app
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

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn test_delete_reservation_requires_admin(pool: PgPool) {
    let (_group_id, _owner_id, resource_id, _collection_id, owner_token) =
        setup_test_environment(&pool, Role::User).await;
    let (other_user_auth, _, _) = setup_user_token(&pool, Role::User).await;
    let (admin_auth, _, _) = setup_user_token(&pool, Role::Admin).await;
    let app = app(pool.clone(), test_config());

    let now = Utc::now();
    let payload = json!({
        "title": "Owner's Booking",
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
                .header(header::AUTHORIZATION, format!("Bearer {owner_token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_res.status(), StatusCode::CREATED);
    let body = to_bytes(create_res.into_body(), usize::MAX).await.unwrap();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let reservation_id = created["id"].as_str().unwrap().to_string();

    let delete_as = |auth: String| {
        Request::builder()
            .method("DELETE")
            .uri(format!("/reservations/{reservation_id}"))
            .header(header::AUTHORIZATION, auth)
            .body(Body::empty())
            .unwrap()
    };

    // A regular user who is not the owner must not be able to delete it
    let res = app
        .clone()
        .oneshot(delete_as(other_user_auth))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    let still_active = sqlx::query_scalar!(
        "SELECT deleted_at IS NULL FROM reservations WHERE id = $1",
        Uuid::parse_str(&reservation_id).unwrap()
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(still_active, Some(true));

    // Even the owner cannot delete: they should cancel instead
    let res = app
        .clone()
        .oneshot(delete_as(format!("Bearer {owner_token}")))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    // An admin can delete any reservation
    let res = app.oneshot(delete_as(admin_auth)).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
}

fn create_payload(resource_id: Uuid, extra: Value) -> Value {
    let start = Utc::now() + Duration::hours(1);
    let mut payload = json!({
        "title": "On behalf",
        "occurrences": [{
            "resource_id": resource_id,
            "start_time": start,
            "end_time": start + Duration::hours(1)
        }]
    });
    payload
        .as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    payload
}

async fn post_reservation(app: axum::Router, token: &str, payload: Value) -> (StatusCode, Value) {
    let response = app
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
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&body).unwrap_or(Value::Null))
}

#[sqlx::test]
async fn test_admin_can_create_reservation_for_another_user(pool: PgPool) {
    let (_group, admin_id, resource_id, _collection, token) =
        setup_test_environment(&pool, Role::Admin).await;
    let (_, other_id, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool, test_config());

    let (status, body) = post_reservation(
        app,
        &token,
        create_payload(resource_id, json!({ "user_id": other_id })),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["user_id"], json!(other_id));
    assert_ne!(body["user_id"], json!(admin_id));
}

#[sqlx::test]
async fn test_non_admin_cannot_create_reservation_for_another_user(pool: PgPool) {
    let (_group, _user_id, resource_id, _collection, token) =
        setup_test_environment(&pool, Role::User).await;
    let (_, other_id, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool, test_config());

    let (status, _) = post_reservation(
        app,
        &token,
        create_payload(resource_id, json!({ "user_id": other_id })),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn test_admin_cannot_create_reservation_for_unknown_user(pool: PgPool) {
    let (_group, _user_id, resource_id, _collection, token) =
        setup_test_environment(&pool, Role::Admin).await;
    let app = app(pool, test_config());

    let (status, _) = post_reservation(
        app,
        &token,
        create_payload(resource_id, json!({ "user_id": Uuid::new_v4() })),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

async fn send(
    app: &axum::Router,
    method: &str,
    uri: &str,
    auth: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, auth);
    let body = match body {
        Some(body) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    let response = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[sqlx::test]
async fn test_owner_can_cancel_own_reservation(pool: PgPool) {
    let (_group_id, owner_id, resource_id, _collection_id, owner_token) =
        setup_test_environment(&pool, Role::User).await;
    let app = app(pool.clone(), test_config());
    let owner_auth = format!("Bearer {owner_token}");

    let (status, created) = post_reservation(
        app.clone(),
        &owner_token,
        create_payload(resource_id, json!({ "status": "confirmed" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = created["id"].as_str().unwrap();

    let (status, cancelled) = send(
        &app,
        "POST",
        &format!("/reservations/{id}/cancel"),
        &owner_auth,
        Some(json!({ "reason": "  Suunnitelmat muuttuivat  " })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(cancelled["status"], "cancelled");
    assert_eq!(cancelled["cancel_reason"], "Suunnitelmat muuttuivat");
    assert_eq!(cancelled["cancelled_by"], owner_id.to_string());
    assert!(cancelled["cancelled_at"].is_string());

    // Cancelling again is a conflict
    let (status, _) = send(
        &app,
        "POST",
        &format!("/reservations/{id}/cancel"),
        &owner_auth,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // The slot is free again
    let (status, again) = post_reservation(
        app.clone(),
        &owner_token,
        create_payload(resource_id, json!({ "status": "confirmed" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{again}");
}

#[sqlx::test]
async fn test_cancel_requires_owner_or_admin(pool: PgPool) {
    let (_group_id, _owner_id, resource_id, _collection_id, owner_token) =
        setup_test_environment(&pool, Role::User).await;
    let (other_auth, _, _) = setup_user_token(&pool, Role::User).await;
    let (admin_auth, admin_id, _) = setup_user_token(&pool, Role::Admin).await;
    let app = app(pool.clone(), test_config());

    let (_, created) = post_reservation(
        app.clone(),
        &owner_token,
        create_payload(resource_id, json!({})),
    )
    .await;
    let id = created["id"].as_str().unwrap();
    let uri = format!("/reservations/{id}/cancel");

    let (status, _) = send(&app, "POST", &uri, &other_auth, None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = send(&app, "POST", &uri, "Bearer invalid", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, cancelled) = send(&app, "POST", &uri, &admin_auth, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(cancelled["status"], "cancelled");
    assert_eq!(cancelled["cancelled_by"], admin_id.to_string());
}

#[sqlx::test]
async fn test_patch_cannot_cancel_or_restore_for_owner(pool: PgPool) {
    let (_group_id, _owner_id, resource_id, _collection_id, owner_token) =
        setup_test_environment(&pool, Role::User).await;
    let (admin_auth, _, _) = setup_user_token(&pool, Role::Admin).await;
    let app = app(pool.clone(), test_config());
    let owner_auth = format!("Bearer {owner_token}");

    let (_, created) = post_reservation(
        app.clone(),
        &owner_token,
        create_payload(resource_id, json!({})),
    )
    .await;
    let id = created["id"].as_str().unwrap();
    let uri = format!("/reservations/{id}");

    // PATCH is no longer a way to cancel
    let (status, _) = send(
        &app,
        "PATCH",
        &uri,
        &owner_auth,
        Some(json!({ "status": "cancelled" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, _) = send(&app, "POST", &format!("{uri}/cancel"), &owner_auth, None).await;
    assert_eq!(status, StatusCode::OK);

    // The owner cannot reopen or edit a cancelled reservation
    let (status, _) = send(
        &app,
        "PATCH",
        &uri,
        &owner_auth,
        Some(json!({ "status": "pending" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // An admin can restore it, which clears the cancel metadata
    let (status, restored) = send(
        &app,
        "PATCH",
        &uri,
        &admin_auth,
        Some(json!({ "status": "pending" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(restored["status"], "pending");
    assert!(restored["cancelled_at"].is_null());
    assert!(restored["cancel_reason"].is_null());
}
