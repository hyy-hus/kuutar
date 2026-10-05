mod common;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use common::{setup_user_token, test_config};
use kuutar::{app, domains::users::models::Role};
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn get(app: &Router, uri: &str, auth: Option<&str>) -> (StatusCode, Value) {
    let mut builder = Request::builder().method("GET").uri(uri);
    if let Some(auth) = auth {
        builder = builder.header(header::AUTHORIZATION, auth);
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

async fn create_resource(pool: &PgPool, name: &str, is_public: bool) -> Uuid {
    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    sqlx::query_scalar!(
        "INSERT INTO resources (collection_id, name, is_public) VALUES ($1, $2, $3) RETURNING id",
        collection_id,
        name,
        is_public
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Inserts a one-hour occurrence `days_ago` days in the past (negative = future)
async fn reserve(
    pool: &PgPool,
    user_id: Uuid,
    resource_id: Uuid,
    status: &str,
    days_ago: i64,
    deleted: bool,
) {
    let reservation_id = sqlx::query_scalar!(
        r#"
        INSERT INTO reservations (user_id, title, status, deleted_at)
        VALUES ($1, 'Booking', $2::text::reservation_status, CASE WHEN $3 THEN now() END)
        RETURNING id
        "#,
        user_id,
        status,
        deleted
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let start = Utc::now() - Duration::days(days_ago);
    sqlx::query!(
        "INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time) VALUES ($1, $2, $3, $4)",
        reservation_id,
        resource_id,
        start,
        start + Duration::hours(1)
    )
    .execute(pool)
    .await
    .unwrap();
}

struct Env {
    app: Router,
    admin: String,
    user: String,
    user_id: Uuid,
    other_id: Uuid,
}

/// Public resource: 2 counted (own + other's) + cancelled + deleted + 100 days old.
/// Private resource: 1 counted. Unused public resource: none.
async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, user_id, _) = setup_user_token(&pool, Role::User).await;
    let (_, other_id, _) = setup_user_token(&pool, Role::User).await;

    let public = create_resource(&pool, "Public", true).await;
    let private = create_resource(&pool, "Private", false).await;
    create_resource(&pool, "Unused", true).await;

    reserve(&pool, user_id, public, "confirmed", 2, false).await;
    reserve(&pool, other_id, public, "pending", 3, false).await;
    reserve(&pool, other_id, public, "cancelled", 4, false).await;
    reserve(&pool, other_id, public, "confirmed", 5, true).await;
    reserve(&pool, other_id, public, "confirmed", 100, false).await;
    reserve(&pool, user_id, private, "confirmed", 6, false).await;
    // Future booking: upcoming for the user, not usage
    reserve(&pool, user_id, public, "confirmed", -3, false).await;

    Env {
        app: app(pool, test_config()),
        admin,
        user,
        user_id,
        other_id,
    }
}

#[sqlx::test]
async fn guest_sees_public_usage_only(pool: PgPool) {
    let env = setup(pool).await;
    let (status, body) = get(&env.app, "/stats?range=30d", None).await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["me"].is_null());
    assert!(body["admin"].is_null());
    // Own + pending on the public resource; cancelled, deleted, private, old and future excluded
    assert_eq!(body["public"]["totals"]["occurrences"], 2);
    assert_eq!(body["public"]["totals"]["resources_used"], 1);
    assert_eq!(body["public"]["public_resources"], 2);
    assert_eq!(
        body["public"]["top_resources"][0]["resource_name"],
        "Public"
    );
    assert_eq!(body["public"]["top_resources"][0]["count"], 2);
    let heat: i64 = body["public"]["weekday_hour"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["count"].as_i64().unwrap())
        .sum();
    assert_eq!(heat, 2);
    assert!(!body["public"]["monthly"].as_array().unwrap().is_empty());
}

#[sqlx::test]
async fn user_gets_own_stats_only(pool: PgPool) {
    let env = setup(pool).await;
    let (status, body) = get(&env.app, "/stats?range=30d", Some(&env.user)).await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["admin"].is_null());
    // Public and private past bookings of the user; the other user's are excluded
    assert_eq!(body["me"]["totals"]["occurrences"], 2);
    assert_eq!(body["me"]["statuses"]["confirmed"], 3);
    assert_eq!(body["me"]["statuses"]["pending"], 0);
    assert_eq!(body["me"]["upcoming"].as_array().unwrap().len(), 1);
    assert_eq!(
        body["me"]["favourite_resources"].as_array().unwrap().len(),
        2
    );
    // The public section stays public-only
    assert_eq!(body["public"]["totals"]["occurrences"], 2);
}

#[sqlx::test]
async fn admin_sees_everything(pool: PgPool) {
    let env = setup(pool).await;
    let (status, body) = get(&env.app, "/stats?range=30d", Some(&env.admin)).await;

    assert_eq!(status, StatusCode::OK);
    let admin = &body["admin"];
    // Public x2, private x1 (cancelled, deleted, old and future excluded)
    assert_eq!(admin["totals"]["occurrences"], 3);
    assert_eq!(admin["total_resources"], 3);
    assert_eq!(admin["pending_now"], 1);
    assert_eq!(admin["statuses"]["cancelled"], 1);
    assert_eq!(admin["unused_resources"].as_array().unwrap().len(), 1);
    assert_eq!(admin["unused_resources"][0]["resource_name"], "Unused");
    assert_eq!(admin["top_resources"].as_array().unwrap().len(), 2);

    let users: Vec<_> = admin["top_users"].as_array().unwrap().iter().collect();
    assert_eq!(users.len(), 2);
    assert_eq!(users[0]["user_id"], env.user_id.to_string());
    assert_eq!(users[0]["count"], 2);
    assert_eq!(users[1]["user_id"], env.other_id.to_string());
    assert_eq!(admin["groups"].as_array().unwrap().len(), 2);
}

#[sqlx::test]
async fn range_limits_usage(pool: PgPool) {
    let env = setup(pool).await;

    for (range, expected) in [("30d", 2), ("90d", 2), ("12m", 3), ("all", 3)] {
        let (status, body) = get(&env.app, &format!("/stats?range={range}"), None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            body["public"]["totals"]["occurrences"], expected,
            "range {range}"
        );
    }

    // Default range is 90 days
    let (_, body) = get(&env.app, "/stats", None).await;
    assert_eq!(body["public"]["totals"]["occurrences"], 2);

    let (status, _) = get(&env.app, "/stats?range=forever", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
