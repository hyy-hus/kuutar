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
        "INSERT INTO resources (collection_id, name, blocks_only, allow_recurring) VALUES ($1, $2, $3, TRUE) RETURNING id",
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
    auth: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, auth);
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

/// Three weekly occurrences on `resource_id` starting tomorrow
fn weekly_occurrences(resource_id: Uuid) -> (Vec<Value>, DateTime<Utc>) {
    let first = Utc::now() + Duration::days(1);
    let occurrences = (0..3)
        .map(|week| {
            let start = first + Duration::weeks(week);
            json!({
                "resource_id": resource_id,
                "start_time": start,
                "end_time": start + Duration::hours(1)
            })
        })
        .collect();
    (occurrences, first)
}

fn occurrence_id(parent: &Value, index: usize) -> Value {
    parent["occurrences"][index]["id"].clone()
}

#[sqlx::test]
async fn splitting_a_reservation_moves_the_occurrence_to_a_new_reservation(pool: PgPool) {
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, false).await;
    let app = app(pool, test_config());
    let (occurrences, _) = weekly_occurrences(resource_id);

    let (status, original) = request(
        &app,
        "POST",
        "/reservations",
        &user,
        Some(json!({
            "title": "Choir",
            "description": "Weekly rehearsal",
            "rrule": "DTSTART;TZID=Europe/Helsinki:20261013T180000\nRRULE:FREQ=WEEKLY;COUNT=3",
            "occurrences": occurrences
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = original["id"].as_str().unwrap();
    // Occurrences come back ordered by start time
    let middle = occurrence_id(&original, 1);

    let new_rrule = "DTSTART;TZID=Europe/Helsinki:20261013T180000\nRRULE:FREQ=WEEKLY;COUNT=3\nEXDATE;TZID=Europe/Helsinki:20261020T180000";
    let (status, split) = request(
        &app,
        "POST",
        &format!("/reservations/{id}/split"),
        &user,
        Some(json!({ "occurrence_ids": [middle], "rrule": new_rrule })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{split}");
    assert_ne!(split["id"], original["id"]);
    assert_eq!(split["title"], "Choir");
    assert_eq!(split["description"], "Weekly rehearsal");
    assert_eq!(split["rrule"], Value::Null);
    assert_eq!(split["occurrences"].as_array().unwrap().len(), 1);
    assert_eq!(split["occurrences"][0]["id"], middle);

    let (_, kept) = request(&app, "GET", &format!("/reservations/{id}"), &user, None).await;
    assert_eq!(kept["occurrences"].as_array().unwrap().len(), 2);
    assert_eq!(kept["rrule"], new_rrule);
}

#[sqlx::test]
async fn split_rejects_foreign_and_exhaustive_requests(pool: PgPool) {
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let (other, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, false).await;
    let app = app(pool, test_config());
    let (occurrences, _) = weekly_occurrences(resource_id);

    let (_, original) = request(
        &app,
        "POST",
        "/reservations",
        &user,
        Some(
            json!({ "title": "Choir", "rrule": "FREQ=WEEKLY;COUNT=3", "occurrences": occurrences }),
        ),
    )
    .await;
    let id = original["id"].as_str().unwrap();
    let first = occurrence_id(&original, 0);

    // Another user can't split it
    let (status, _) = request(
        &app,
        "POST",
        &format!("/reservations/{id}/split"),
        &other,
        Some(json!({ "occurrence_ids": [first], "rrule": null })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // An occurrence that belongs to nothing here
    let (status, _) = request(
        &app,
        "POST",
        &format!("/reservations/{id}/split"),
        &user,
        Some(json!({ "occurrence_ids": [Uuid::new_v4()], "rrule": null })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Moving every occurrence would leave the original empty
    let all: Vec<Value> = (0..3).map(|i| occurrence_id(&original, i)).collect();
    let (status, _) = request(
        &app,
        "POST",
        &format!("/reservations/{id}/split"),
        &user,
        Some(json!({ "occurrence_ids": all, "rrule": null })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Nothing moved: the failed attempts rolled back
    let (_, kept) = request(&app, "GET", &format!("/reservations/{id}"), &user, None).await;
    assert_eq!(kept["occurrences"].as_array().unwrap().len(), 3);
    assert_eq!(kept["rrule"], "FREQ=WEEKLY;COUNT=3");
}

#[sqlx::test]
async fn updating_with_occurrences_can_clear_the_rule(pool: PgPool) {
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, false).await;
    let app = app(pool, test_config());
    let (occurrences, first) = weekly_occurrences(resource_id);

    let (_, original) = request(
        &app,
        "POST",
        "/reservations",
        &user,
        Some(
            json!({ "title": "Choir", "rrule": "FREQ=WEEKLY;COUNT=3", "occurrences": occurrences }),
        ),
    )
    .await;
    let id = original["id"].as_str().unwrap();

    // A title-only edit keeps the rule
    let (status, edited) = request(
        &app,
        "PATCH",
        &format!("/reservations/{id}"),
        &user,
        Some(json!({ "title": "Choir (new)" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(edited["rrule"], "FREQ=WEEKLY;COUNT=3");

    // Replacing the occurrences without a rule makes it a single reservation
    let (status, single) = request(
        &app,
        "PATCH",
        &format!("/reservations/{id}"),
        &user,
        Some(json!({
            "rrule": null,
            "occurrences": [{
                "resource_id": resource_id,
                "start_time": first,
                "end_time": first + Duration::hours(1)
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{single}");
    assert_eq!(single["rrule"], Value::Null);
}

#[sqlx::test]
async fn splitting_a_restriction_keeps_its_group_exemptions(pool: PgPool) {
    let (admin, _, group_id) = setup_user_token(&pool, Role::Admin).await;
    let resource_id = create_resource(&pool, false).await;
    let app = app(pool, test_config());
    let (occurrences, _) = weekly_occurrences(resource_id);

    let (status, original) = request(
        &app,
        "POST",
        "/restrictions",
        &admin,
        Some(json!({
            "title": "Cleaning",
            "rrule": "FREQ=WEEKLY;COUNT=3",
            "exempt_group_ids": [group_id],
            "occurrences": occurrences
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{original}");
    let id = original["id"].as_str().unwrap();

    let (status, split) = request(
        &app,
        "POST",
        &format!("/restrictions/{id}/split"),
        &admin,
        Some(json!({ "occurrence_ids": [occurrence_id(&original, 2)], "rrule": "FREQ=WEEKLY;COUNT=2" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{split}");
    assert_eq!(split["title"], "Cleaning");
    assert_eq!(split["rrule"], Value::Null);
    assert_eq!(split["exempt_group_ids"], json!([group_id]));
    assert_eq!(split["occurrences"].as_array().unwrap().len(), 1);

    let (_, kept) = request(&app, "GET", &format!("/restrictions/{id}"), &admin, None).await;
    assert_eq!(kept["occurrences"].as_array().unwrap().len(), 2);
    assert_eq!(kept["rrule"], "FREQ=WEEKLY;COUNT=2");
}

#[sqlx::test]
async fn splitting_a_block_is_admin_only(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource_id = create_resource(&pool, true).await;
    let app = app(pool, test_config());
    let (occurrences, _) = weekly_occurrences(resource_id);

    let (status, original) = request(
        &app,
        "POST",
        "/reservable-blocks",
        &admin,
        Some(json!({ "title": "Evening", "rrule": "FREQ=WEEKLY;COUNT=3", "occurrences": occurrences })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{original}");
    let id = original["id"].as_str().unwrap();
    let body =
        json!({ "occurrence_ids": [occurrence_id(&original, 0)], "rrule": "FREQ=WEEKLY;COUNT=2" });

    let (status, _) = request(
        &app,
        "POST",
        &format!("/reservable-blocks/{id}/split"),
        &user,
        Some(body.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, split) = request(
        &app,
        "POST",
        &format!("/reservable-blocks/{id}/split"),
        &admin,
        Some(body),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{split}");
    assert_eq!(split["rrule"], Value::Null);
    assert_eq!(split["occurrences"].as_array().unwrap().len(), 1);

    let (_, kept) = request(
        &app,
        "GET",
        &format!("/reservable-blocks/{id}"),
        &admin,
        None,
    )
    .await;
    assert_eq!(kept["occurrences"].as_array().unwrap().len(), 2);
}
