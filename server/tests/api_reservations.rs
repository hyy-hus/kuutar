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
        "description": {"fi": {"type": "doc", "content": []}},
        "message_to_admins": "Please set up the projector",
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
    let body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let fetched: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(fetched["description"]["fi"]["type"], "doc");
    // The owner sees their own message to the admins
    assert_eq!(fetched["message_to_admins"], "Please set up the projector");
}

#[sqlx::test]
async fn test_message_to_admins_hidden_from_public_calendar(pool: PgPool) {
    let (_group_id, _user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool, Role::Admin).await;
    let app = app(pool, test_config());

    let start_time = Utc::now() + Duration::hours(1);
    let payload = json!({
        "title": "Public Event",
        "description": {"fi": {"type": "doc", "content": []}},
        "message_to_admins": "Door code is 1234",
        "status": "confirmed",
        "occurrences": [{
            "resource_id": resource_id,
            "start_time": start_time,
            "end_time": start_time + Duration::hours(1)
        }]
    });

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

    // Anonymous visitors see the confirmed reservation and its public description only
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/reservations")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let list: Value = serde_json::from_slice(&body).unwrap();
    let reservation = &list.as_array().unwrap()[0];
    assert_eq!(reservation["title"], "Public Event");
    assert_eq!(reservation["description"]["fi"]["type"], "doc");
    assert!(reservation.get("message_to_admins").is_none());
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

// --- Listings and checks over many rows (pin the behaviour of the batched queries) ---

async fn insert_resource(pool: &PgPool, collection_id: Uuid, is_public: bool) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO resources (collection_id, name, allow_recurring, is_public)
         VALUES ($1, $2, TRUE, $3) RETURNING id",
    )
    .bind(collection_id)
    .bind(format!("Resource {}", Uuid::new_v4()))
    .bind(is_public)
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Inserts a reservation with the given occurrences (resource, start offset in hours, length in hours)
async fn insert_reservation(
    pool: &PgPool,
    user_id: Uuid,
    title: &str,
    status: &str,
    created_at: chrono::DateTime<Utc>,
    occurrences: &[(Uuid, i64, i64)],
    base: chrono::DateTime<Utc>,
) -> Uuid {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO reservations (user_id, title, status, created_at)
         VALUES ($1, $2, $3::reservation_status, $4) RETURNING id",
    )
    .bind(user_id)
    .bind(title)
    .bind(status)
    .bind(created_at)
    .fetch_one(pool)
    .await
    .unwrap();
    for (resource_id, start_h, len_h) in occurrences {
        sqlx::query(
            "INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(id)
        .bind(resource_id)
        .bind(base + Duration::hours(*start_h))
        .bind(base + Duration::hours(start_h + len_h))
        .execute(pool)
        .await
        .unwrap();
    }
    id
}

async fn get_json(app: &axum::Router, uri: &str, token: Option<&str>) -> (StatusCode, Value) {
    let mut req = Request::builder().method("GET").uri(uri);
    if let Some(token) = token {
        req = req.header(header::AUTHORIZATION, token);
    }
    let response = app
        .clone()
        .oneshot(req.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&body).unwrap_or(Value::Null))
}

async fn post_json(
    app: &axum::Router,
    uri: &str,
    token: &str,
    payload: Value,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header(header::AUTHORIZATION, token)
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

/// (title, [occurrence start times]) for each listed reservation, in response order
fn listing(json: &Value) -> Vec<(String, Vec<String>)> {
    json.as_array()
        .unwrap()
        .iter()
        .map(|r| {
            (
                r["title"].as_str().unwrap().to_string(),
                r["occurrences"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|o| o["start_time"].as_str().unwrap().to_string())
                    .collect(),
            )
        })
        .collect()
}

fn ts(base: chrono::DateTime<Utc>, hours: i64) -> String {
    (base + Duration::hours(hours)).to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true)
}

#[sqlx::test]
async fn test_list_groups_and_filters_occurrences_per_reservation(pool: PgPool) {
    let (user_token, user_id, _group_id) = setup_user_token(&pool, Role::User).await;
    let (admin_token, admin_id, _) = setup_user_token(&pool, Role::Admin).await;
    let collection_id: Uuid =
        sqlx::query_scalar("INSERT INTO collections (name) VALUES ('Lists') RETURNING id")
            .fetch_one(&pool)
            .await
            .unwrap();
    let public = insert_resource(&pool, collection_id, true).await;
    let hidden = insert_resource(&pool, collection_id, false).await;
    let other = insert_resource(&pool, collection_id, true).await;

    let base = chrono::DateTime::parse_from_rfc3339("2030-03-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let created = base - Duration::days(10);

    // Occurrences inserted out of order, one outside the window and one on a hidden resource
    insert_reservation(
        &pool,
        user_id,
        "Mine",
        "confirmed",
        created,
        &[
            (public, 30, 1),
            (hidden, 20, 1),
            (public, 10, 1),
            (public, 24 * 40, 1),
        ],
        base,
    )
    .await;
    insert_reservation(
        &pool,
        admin_id,
        "Theirs",
        "confirmed",
        created + Duration::hours(1),
        &[(other, 40, 2), (public, 15, 1)],
        base,
    )
    .await;
    insert_reservation(
        &pool,
        user_id,
        "Pending",
        "pending",
        created + Duration::hours(2),
        &[(public, 50, 1)],
        base,
    )
    .await;
    insert_reservation(
        &pool,
        admin_id,
        "Hidden only",
        "confirmed",
        created + Duration::hours(3),
        &[(hidden, 60, 1)],
        base,
    )
    .await;

    let app = app(pool, test_config());
    let window = format!(
        "start_date={}&end_date={}",
        ts(base, 0).replace('+', "%2B"),
        ts(base, 24 * 30).replace('+', "%2B")
    );

    // Guests: confirmed only, hidden occurrences and reservations left out, newest first
    let (status, json) = get_json(&app, &format!("/reservations?{window}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        listing(&json),
        vec![
            ("Theirs".to_string(), vec![ts(base, 15), ts(base, 40)]),
            ("Mine".to_string(), vec![ts(base, 10), ts(base, 30)]),
        ]
    );
    assert!(json[0]["user_email"].is_null());

    // Admins: every status and every resource, still only the window
    let (status, json) =
        get_json(&app, &format!("/reservations?{window}"), Some(&admin_token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        listing(&json),
        vec![
            ("Hidden only".to_string(), vec![ts(base, 60)]),
            ("Pending".to_string(), vec![ts(base, 50)]),
            ("Theirs".to_string(), vec![ts(base, 15), ts(base, 40)]),
            (
                "Mine".to_string(),
                vec![ts(base, 10), ts(base, 20), ts(base, 30)]
            ),
        ]
    );

    // Owners see all their own occurrences in the window, hidden resource included
    let (status, json) = get_json(
        &app,
        &format!("/reservations/me?{window}"),
        Some(&user_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        listing(&json),
        vec![
            ("Pending".to_string(), vec![ts(base, 50)]),
            (
                "Mine".to_string(),
                vec![ts(base, 10), ts(base, 20), ts(base, 30)]
            ),
        ]
    );
}

#[sqlx::test]
async fn test_check_conflicts_with_many_occurrences(pool: PgPool) {
    let (_group_id, user_id, resource_id, _collection_id, token) =
        setup_test_environment(&pool, Role::User).await;
    let base = Utc::now() + Duration::days(5);
    let existing = insert_reservation(
        &pool,
        user_id,
        "Existing",
        "confirmed",
        Utc::now(),
        &[(resource_id, 0, 2), (resource_id, 10, 2)],
        base,
    )
    .await;
    let occ_ids: Vec<(Uuid, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, start_time FROM occurrences WHERE reservation_id = $1 ORDER BY start_time",
    )
    .bind(existing)
    .fetch_all(&pool)
    .await
    .unwrap();
    let (first, second) = (occ_ids[0].0.to_string(), occ_ids[1].0.to_string());

    let occ = |start_h: i64, len_h: i64| {
        json!({
            "resource_id": resource_id,
            "start_time": base + Duration::hours(start_h),
            "end_time": base + Duration::hours(start_h + len_h),
        })
    };
    let app = app(pool, test_config());
    // Overlaps the second, nothing, the first, and the first again
    let payload = json!([occ(11, 1), occ(5, 1), occ(1, 1), occ(0, 3)]);
    let (status, json) = post_json(
        &app,
        "/reservations/check-conflicts",
        &format!("Bearer {token}"),
        payload.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let ids: Vec<&str> = json
        .as_array()
        .unwrap()
        .iter()
        .map(|o| o["id"].as_str().unwrap())
        .collect();
    assert_eq!(ids, vec![second.as_str(), first.as_str(), first.as_str()]);

    // The reservation being edited is ignored
    let (status, json) = post_json(
        &app,
        &format!("/reservations/check-conflicts?exclude_reservation_id={existing}"),
        &format!("Bearer {token}"),
        payload,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json.as_array().unwrap().len(), 0);
}

#[sqlx::test]
async fn test_create_reports_violation_of_a_later_occurrence(pool: PgPool) {
    let (_group_id, _user_id, resource_id, collection_id, token) =
        setup_test_environment(&pool, Role::User).await;
    let token = format!("Bearer {token}");
    let base = Utc::now() + Duration::days(5);
    let limited = insert_resource(&pool, collection_id, true).await;
    sqlx::query(
        "UPDATE resources SET name = 'Limited room', max_duration_minutes = 120, reservable_until = $2
         WHERE id = $1",
    )
    .bind(limited)
    .bind(base + Duration::days(3))
    .execute(&pool)
    .await
    .unwrap();

    let restriction_id: Uuid =
        sqlx::query_scalar("INSERT INTO restrictions (title) VALUES ('Exam week') RETURNING id")
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query(
        "INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(restriction_id)
    .bind(resource_id)
    .bind(base + Duration::hours(48))
    .bind(base + Duration::hours(72))
    .execute(&pool)
    .await
    .unwrap();

    let occ = |res: Uuid, start_h: i64, len_h: i64| {
        json!({
            "resource_id": res,
            "start_time": base + Duration::hours(start_h),
            "end_time": base + Duration::hours(start_h + len_h),
        })
    };
    let create = |occurrences: Vec<Value>| json!({ "title": "Many", "occurrences": occurrences });
    let app = app(pool, test_config());

    // The restriction hits only the third occurrence
    let (status, json) = post_json(
        &app,
        "/reservations",
        &token,
        create(vec![
            occ(resource_id, 0, 1),
            occ(resource_id, 24, 1),
            occ(resource_id, 50, 1),
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(
        json["error"].as_str().unwrap().contains("Exam week"),
        "{json}"
    );

    // Too long on the second occurrence
    let (status, json) = post_json(
        &app,
        "/reservations",
        &token,
        create(vec![occ(limited, 0, 1), occ(limited, 5, 3)]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        json["error"].as_str().unwrap().contains("enimmäiskesto"),
        "{json}"
    );

    // Past reservable_until on the second occurrence
    let (status, json) = post_json(
        &app,
        "/reservations",
        &token,
        create(vec![occ(limited, 0, 1), occ(limited, 24 * 4, 1)]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(json["error"].as_str().unwrap().contains("asti"), "{json}");

    // Durations are checked before reservable_until, whatever the occurrence order
    let (status, json) = post_json(
        &app,
        "/reservations",
        &token,
        create(vec![occ(limited, 24 * 4, 1), occ(limited, 5, 3)]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        json["error"].as_str().unwrap().contains("enimmäiskesto"),
        "{json}"
    );

    // Everything valid across both resources goes through
    let (status, json) = post_json(
        &app,
        "/reservations",
        &token,
        create(vec![
            occ(limited, 0, 2),
            occ(resource_id, 1, 1),
            occ(limited, 24, 1),
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{json}");
    assert_eq!(json["occurrences"].as_array().unwrap().len(), 3);
}

#[sqlx::test]
async fn test_batch_import_with_many_occurrences(pool: PgPool) {
    let (admin_token, _admin_id, _) = setup_user_token(&pool, Role::Admin).await;
    let collection_id: Uuid =
        sqlx::query_scalar("INSERT INTO collections (name) VALUES ('Import') RETURNING id")
            .fetch_one(&pool)
            .await
            .unwrap();
    for name in ["Hall", "Sauna"] {
        sqlx::query("INSERT INTO resources (collection_id, name) VALUES ($1, $2)")
            .bind(collection_id)
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
    }
    let base = Utc::now() + Duration::days(3);
    let occ = |name: &str, h: i64| {
        json!({
            "resource_name": name,
            "start_time": base + Duration::hours(h),
            "end_time": base + Duration::hours(h + 1),
        })
    };
    let app = app(pool.clone(), test_config());

    // An unknown resource on the second item rolls the whole import back
    let (status, json) = post_json(
        &app,
        "/reservations/batch-import",
        &admin_token,
        json!([
            { "title": "First", "occurrences": [occ("Hall", 0)] },
            { "title": "Second", "occurrences": [occ("Hall", 2), occ("Nowhere", 3)] },
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(json["error"].as_str().unwrap().contains("Rivi 2"), "{json}");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM occurrences")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    let (status, json) = post_json(
        &app,
        "/reservations/batch-import",
        &admin_token,
        json!([
            { "title": "First", "occurrences": [occ("hall", 5), occ("Sauna", 1), occ("Hall", 3)] },
            { "title": "Second", "occurrences": [occ("Sauna", 7)] },
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{json}");
    assert_eq!(json["imported_count"], 2);
    let first: Uuid = json["reservation_ids"][0]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    let rows: Vec<(String, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT rs.name, o.start_time FROM occurrences o JOIN resources rs ON rs.id = o.resource_id
         WHERE o.reservation_id = $1 ORDER BY o.start_time",
    )
    .bind(first)
    .fetch_all(&pool)
    .await
    .unwrap();
    let names: Vec<&str> = rows.iter().map(|(n, _)| n.as_str()).collect();
    assert_eq!(names, vec!["Sauna", "Hall", "Hall"]);
}
