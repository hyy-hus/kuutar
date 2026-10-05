mod common;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{DateTime, Duration, Utc};
use common::{setup_user_token, test_config};
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

fn block_payload(resource_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> Value {
    json!({
        "title": "Evening slot",
        "occurrences": [{ "resource_id": resource_id, "start_time": start, "end_time": end }]
    })
}

fn reservation_payload(resource_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> Value {
    json!({
        "title": "Booking",
        "occurrences": [{ "resource_id": resource_id, "start_time": start, "end_time": end }]
    })
}

struct Env {
    pool: PgPool,
    app: Router,
    admin: String,
    user: String,
    resource_id: Uuid,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
}

/// A blocks-only resource with one block created by an admin
async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, true).await;
    let app = app(pool.clone(), test_config());

    let start = Utc::now() + Duration::days(1);
    let end = start + Duration::hours(2);
    let (status, _) = request(
        &app,
        "POST",
        "/reservable-blocks",
        Some(&admin),
        Some(block_payload(resource_id, start, end)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    Env {
        pool,
        app,
        admin,
        user,
        resource_id,
        start,
        end,
    }
}

#[sqlx::test]
async fn admin_manages_blocks_and_users_cannot(pool: PgPool) {
    let env = setup(pool).await;
    let payload = block_payload(env.resource_id, env.start, env.end);

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservable-blocks",
        Some(&env.user),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, created) = request(
        &env.app,
        "POST",
        "/reservable-blocks",
        Some(&env.admin),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = created["id"].as_str().unwrap();

    let (status, updated) = request(
        &env.app,
        "PATCH",
        &format!("/reservable-blocks/{id}"),
        Some(&env.admin),
        Some(json!({ "title": "Renamed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["title"], "Renamed");
    assert_eq!(updated["occurrences"].as_array().unwrap().len(), 1);

    let (status, _) = request(
        &env.app,
        "DELETE",
        &format!("/reservable-blocks/{id}"),
        Some(&env.user),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = request(
        &env.app,
        "DELETE",
        &format!("/reservable-blocks/{id}"),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _) = request(
        &env.app,
        "GET",
        &format!("/reservable-blocks/{id}"),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn block_requires_blocks_only_resource(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let normal_resource = create_resource(&pool, false).await;
    let app = app(pool, test_config());

    let start = Utc::now() + Duration::days(1);
    let (status, _) = request(
        &app,
        "POST",
        "/reservable-blocks",
        Some(&admin),
        Some(block_payload(
            normal_resource,
            start,
            start + Duration::hours(1),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn user_can_reserve_exact_block_once(pool: PgPool) {
    let env = setup(pool).await;
    let payload = reservation_payload(env.resource_id, env.start, env.end);

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.user),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    // The block now shows as reserved
    let (status, listed) = request(
        &env.app,
        "GET",
        &format!(
            "/reservable-blocks?resource_id={}&start_date={}&end_date={}",
            env.resource_id,
            (env.start - Duration::days(1))
                .to_rfc3339()
                .replace('+', "%2B"),
            (env.end + Duration::days(1))
                .to_rfc3339()
                .replace('+', "%2B"),
        ),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed[0]["occurrences"][0]["reserved"], true);

    // A second user cannot take the same block
    let (other, _, _) = setup_user_token(&env.pool, Role::User).await;
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&other),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test]
async fn user_cannot_reserve_outside_or_partially_inside_block(pool: PgPool) {
    let env = setup(pool).await;

    for (start, end) in [
        (env.start + Duration::hours(3), env.end + Duration::hours(4)),
        (env.start, env.end - Duration::minutes(30)),
        (env.start + Duration::minutes(30), env.end),
        (env.start - Duration::hours(1), env.end + Duration::hours(1)),
    ] {
        let (status, _) = request(
            &env.app,
            "POST",
            "/reservations",
            Some(&env.user),
            Some(reservation_payload(env.resource_id, start, end)),
        )
        .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{start} - {end}");
    }
}

#[sqlx::test]
async fn user_cannot_use_rrule_on_blocks_only_resource(pool: PgPool) {
    let env = setup(pool).await;
    let mut payload = reservation_payload(env.resource_id, env.start, env.end);
    payload["rrule"] = json!("FREQ=WEEKLY");

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.user),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn admin_can_reserve_outside_blocks(pool: PgPool) {
    let env = setup(pool).await;
    let start = env.end + Duration::hours(5);

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.admin),
        Some(reservation_payload(
            env.resource_id,
            start,
            start + Duration::hours(1),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
}

#[sqlx::test]
async fn normal_resources_are_unaffected(pool: PgPool) {
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, false).await;
    let app = app(pool, test_config());

    let start = Utc::now() + Duration::days(2);
    let (status, _) = request(
        &app,
        "POST",
        "/reservations",
        Some(&user),
        Some(reservation_payload(
            resource_id,
            start,
            start + Duration::hours(1),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
}

#[sqlx::test]
async fn user_can_edit_own_block_reservation_without_self_conflict(pool: PgPool) {
    let env = setup(pool).await;
    let (status, created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.user),
        Some(reservation_payload(env.resource_id, env.start, env.end)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = created["id"].as_str().unwrap();

    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{id}"),
        Some(&env.user),
        Some(json!({
            "title": "Renamed",
            "occurrences": [{
                "resource_id": env.resource_id,
                "start_time": env.start,
                "end_time": env.end
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Moving it off the block is rejected
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{id}"),
        Some(&env.user),
        Some(json!({
            "occurrences": [{
                "resource_id": env.resource_id,
                "start_time": env.start + Duration::hours(1),
                "end_time": env.end + Duration::hours(1)
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}
