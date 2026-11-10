mod common;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{DateTime, Duration, Utc};
use common::{create_group, setup_user_in_group, setup_user_token, test_config};
use kuutar::{app, domains::users::models::Role};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn create_resource(pool: &PgPool, blocks_only: bool) -> Uuid {
    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    sqlx::query_scalar!(
        "INSERT INTO resources (collection_id, name, blocks_only) VALUES ($1, $2, $3) RETURNING id",
        collection_id,
        format!("Resource {}", Uuid::new_v4()),
        blocks_only
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn request(
    app: &Router,
    method: &str,
    uri: &str,
    auth: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(auth) = auth {
        builder = builder.header(header::AUTHORIZATION, auth);
    }
    let body = match body {
        Some(json) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
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

struct Env {
    pool: PgPool,
    app: Router,
    admin: String,
    group_id: Uuid,
    resource_id: Uuid,
    round_id: Uuid,
    slots: Vec<(DateTime<Utc>, DateTime<Utc>)>,
}

fn application(round_id: Uuid, resource_id: Uuid, slot: (DateTime<Utc>, DateTime<Utc>)) -> Value {
    json!({
        "title": "Application",
        "round_id": round_id,
        "occurrences": [{ "resource_id": resource_id, "start_time": slot.0, "end_time": slot.1 }]
    })
}

fn booking(resource_id: Uuid, slot: (DateTime<Utc>, DateTime<Utc>)) -> Value {
    json!({
        "title": "Booking",
        "occurrences": [{ "resource_id": resource_id, "start_time": slot.0, "end_time": slot.1 }]
    })
}

/// A blocks-only resource with three blocks and an open round (max 2 applications) for one group
async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let group_id = create_group(&pool).await;
    let resource_id = create_resource(&pool, true).await;
    let app = app(pool.clone(), test_config());

    let first = Utc::now() + Duration::days(1);
    let slots: Vec<_> = (0..3)
        .map(|i| {
            let start = first + Duration::days(i);
            (start, start + Duration::hours(2))
        })
        .collect();
    for slot in &slots {
        let (status, _) = request(
            &app,
            "POST",
            "/reservable-blocks",
            Some(&admin),
            Some(json!({
                "title": "Slot",
                "occurrences": [{ "resource_id": resource_id, "start_time": slot.0, "end_time": slot.1 }]
            })),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
    }

    let (status, round) = request(
        &app,
        "POST",
        "/rounds",
        Some(&admin),
        Some(json!({
            "name": "Autumn round",
            "applications_open_at": Utc::now() - Duration::hours(1),
            "applications_close_at": Utc::now() + Duration::hours(1),
            "period_start": first - Duration::hours(1),
            "period_end": first + Duration::days(10),
            "max_pending_per_resource": 2,
            "resource_ids": [resource_id],
            "group_ids": [group_id]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{round}");
    assert_eq!(round["phase"], "open");
    let round_id = round["id"].as_str().unwrap().parse().unwrap();

    Env {
        pool,
        app,
        admin,
        group_id,
        resource_id,
        round_id,
        slots,
    }
}

async fn close_window(env: &Env) {
    sqlx::query!(
        "UPDATE reservation_rounds SET applications_close_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
        env.round_id
    )
    .execute(&env.pool)
    .await
    .unwrap();
}

#[sqlx::test]
async fn round_requires_blocks_only_resources(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let group_id = create_group(&pool).await;
    let plain = create_resource(&pool, false).await;
    let app = app(pool.clone(), test_config());

    let (status, _) = request(
        &app,
        "POST",
        "/rounds",
        Some(&admin),
        Some(json!({
            "name": "Bad",
            "applications_open_at": Utc::now(),
            "applications_close_at": Utc::now() + Duration::days(1),
            "period_start": Utc::now(),
            "period_end": Utc::now() + Duration::days(30),
            "max_pending_per_resource": 1,
            "resource_ids": [plain],
            "group_ids": [group_id]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn overlapping_windows_on_same_resource_are_rejected(pool: PgPool) {
    let env = setup(pool).await;
    let payload = |open: i64, close: i64| {
        json!({
            "name": "Second",
            "applications_open_at": Utc::now() + Duration::hours(open),
            "applications_close_at": Utc::now() + Duration::hours(close),
            "period_start": Utc::now(),
            "period_end": Utc::now() + Duration::days(30),
            "max_pending_per_resource": 1,
            "resource_ids": [env.resource_id],
            "group_ids": [env.group_id]
        })
    };
    let (status, _) = request(
        &env.app,
        "POST",
        "/rounds",
        Some(&env.admin),
        Some(payload(0, 5)),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    // A round that follows the first one is fine, but not a second one in the same window
    let (status, _) = request(
        &env.app,
        "POST",
        "/rounds",
        Some(&env.admin),
        Some(payload(2, 9)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = request(
        &env.app,
        "POST",
        "/rounds",
        Some(&env.admin),
        Some(payload(3, 12)),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test]
async fn applications_respect_group_limit_and_block_normal_booking(pool: PgPool) {
    let env = setup(pool).await;
    let (alice, _) = setup_user_in_group(&env.pool, Role::User, env.group_id).await;
    let (outsider, _, _) = setup_user_token(&env.pool, Role::User).await;

    // Outside the eligible groups
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&outsider),
        Some(application(env.round_id, env.resource_id, env.slots[0])),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    for (i, slot) in env.slots.iter().take(2).enumerate() {
        let (status, body) = request(
            &env.app,
            "POST",
            "/reservations",
            Some(&alice),
            Some(application(env.round_id, env.resource_id, *slot)),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        assert_eq!(body["status"], "pending");
        assert_eq!(body["round_priority"], i as i64 + 1);
    }
    // Applied-for blocks stay free for others to apply for
    let (_, blocks) = request(
        &env.app,
        "GET",
        &format!(
            "/reservable-blocks?resource_id={}&start_date={}&end_date={}",
            env.resource_id,
            Utc::now().to_rfc3339().replace('+', "%2B"),
            (Utc::now() + Duration::days(30))
                .to_rfc3339()
                .replace('+', "%2B")
        ),
        None,
        None,
    )
    .await;
    assert!(
        blocks.as_array().unwrap().iter().all(|b| b["occurrences"]
            .as_array()
            .unwrap()
            .iter()
            .all(|o| o["reserved"] == false)),
        "{blocks}"
    );

    // Maximum is 2 per resource
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&alice),
        Some(application(env.round_id, env.resource_id, env.slots[2])),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Normal booking is closed while the round is unfinished
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&outsider),
        Some(booking(env.resource_id, env.slots[2])),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn full_round_flow(pool: PgPool) {
    let env = setup(pool).await;
    let (alice, _) = setup_user_in_group(&env.pool, Role::User, env.group_id).await;
    let (bob, _) = setup_user_in_group(&env.pool, Role::User, env.group_id).await;

    let mut alice_ids = Vec::new();
    for slot in env.slots.iter().take(2) {
        let (_, body) = request(
            &env.app,
            "POST",
            "/reservations",
            Some(&alice),
            Some(application(env.round_id, env.resource_id, *slot)),
        )
        .await;
        alice_ids.push(body["id"].as_str().unwrap().to_string());
    }
    // Both want the first slot; applications for one slot from several users are allowed
    let (status, bob_res) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&bob),
        Some(application(env.round_id, env.resource_id, env.slots[0])),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let bob_id = bob_res["id"].as_str().unwrap().to_string();

    // Alice puts her second block first
    let (status, _) = request(&env.app, "PUT", &format!("/rounds/{}/priorities", env.round_id), Some(&alice),
        Some(json!({ "resource_id": env.resource_id, "reservation_ids": [alice_ids[1], alice_ids[0]] }))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, mine) = request(
        &env.app,
        "GET",
        &format!("/reservations/me?round_id={}", env.round_id),
        Some(&alice),
        None,
    )
    .await;
    let second = mine
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == alice_ids[1])
        .unwrap();
    assert_eq!(second["round_priority"], 1);

    // Allocation is only possible once the window has closed
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/allocate", env.round_id),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    close_window(&env).await;

    // Completing needs a saved allocation
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/complete", env.round_id),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, proposal) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/allocate", env.round_id),
        Some(&env.admin),
        Some(json!({ "seed": 5 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, again) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/allocate", env.round_id),
        Some(&env.admin),
        Some(json!({ "seed": 5 })),
    )
    .await;
    assert_eq!(proposal, again);
    // Alice ranks the second block first, Bob only wants the first, so both get one
    assert_eq!(proposal["reservation_ids"].as_array().unwrap().len(), 2);

    // Two grants for the same slot are rejected
    let (status, _) = request(
        &env.app,
        "PUT",
        &format!("/rounds/{}/allocation", env.round_id),
        Some(&env.admin),
        Some(json!({ "reservation_ids": [alice_ids[0], bob_id] })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, saved) = request(
        &env.app,
        "PUT",
        &format!("/rounds/{}/allocation", env.round_id),
        Some(&env.admin),
        Some(json!({ "reservation_ids": proposal["reservation_ids"] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{saved}");

    let (status, report) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/complete", env.round_id),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    assert_eq!(report["confirmed_count"], 2);
    assert_eq!(report["cancelled_count"], 1);

    let statuses = sqlx::query!(
        r#"SELECT status::text AS "status!", COUNT(*) AS "n!" FROM reservations WHERE round_id = $1 GROUP BY status"#,
        env.round_id
    )
    .fetch_all(&env.pool)
    .await
    .unwrap();
    assert!(statuses.iter().any(|s| s.status == "confirmed" && s.n == 2));
    assert!(statuses.iter().any(|s| s.status == "cancelled" && s.n == 1));

    // Normal rules apply again: the unclaimed third block can be booked
    let (status, body) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&bob),
        Some(booking(env.resource_id, env.slots[2])),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");

    // The admin overview keeps all applications with their outcome
    let (status, apps) = request(
        &env.app,
        "GET",
        &format!("/rounds/{}/applications", env.round_id),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let apps = apps.as_array().unwrap();
    assert_eq!(apps.len(), 3);
    assert_eq!(
        apps.iter().filter(|a| a["status"] == "confirmed").count(),
        2
    );
    assert_eq!(
        apps.iter().filter(|a| a["status"] == "cancelled").count(),
        1
    );
    assert!(apps.iter().all(|a| a["user_email"].is_string()));

    // A completed round cannot be completed twice
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/rounds/{}/complete", env.round_id),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test]
async fn admin_can_close_applications_early_but_not_change_locked_fields(pool: PgPool) {
    let env = setup(pool).await;
    let uri = format!("/rounds/{}", env.round_id);

    // The window has opened, so the period is locked
    let (status, _) = request(
        &env.app,
        "PATCH",
        &uri,
        Some(&env.admin),
        Some(json!({ "period_end": Utc::now() + Duration::days(60) })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, round) = request(
        &env.app,
        "PATCH",
        &uri,
        Some(&env.admin),
        Some(json!({ "name": "Renamed", "applications_close_at": Utc::now() })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{round}");
    assert_eq!(round["name"], "Renamed");
    assert_eq!(round["phase"], "allocating");
}
