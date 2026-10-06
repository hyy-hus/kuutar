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

fn reservation(resource_ids: &[Uuid], start: DateTime<Utc>) -> Value {
    json!({
        "title": "Booking",
        "occurrences": resource_ids.iter().map(|id| json!({
            "resource_id": id,
            "start_time": start,
            "end_time": start + Duration::hours(1),
        })).collect::<Vec<_>>()
    })
}

fn tomorrow() -> DateTime<Utc> {
    Utc::now() + Duration::days(1)
}

async fn setup(pool: PgPool) -> (Router, String, String, Uuid) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool.clone(), test_config());
    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let (status, resource) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({
            "collection_id": collection_id,
            "name": "Room",
            "default_duration_minutes": 120,
            "min_duration_minutes": 60,
            "max_duration_minutes": 240,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{resource}");
    assert_eq!(resource["default_duration_minutes"], 120);
    let id = resource["id"].as_str().unwrap().parse().unwrap();
    (app, admin, user, id)
}

async fn book_hours(app: &Router, auth: &str, resource: Uuid, hours: i64) -> StatusCode {
    let start = tomorrow();
    let (status, _) = request(
        app,
        "POST",
        "/reservations",
        Some(auth),
        Some(json!({
            "title": "Booking",
            "occurrences": [{
                "resource_id": resource,
                "start_time": start,
                "end_time": start + Duration::hours(hours),
            }]
        })),
    )
    .await;
    status
}

#[sqlx::test]
async fn min_and_max_duration_apply_to_users_not_admins(pool: PgPool) {
    let (app, admin, user, resource) = setup(pool).await;

    assert_eq!(
        book_hours(&app, &user, resource, 2).await,
        StatusCode::CREATED
    );
    assert_eq!(
        book_hours(&app, &user, resource, 1).await,
        StatusCode::CREATED
    );
    assert_eq!(
        book_hours(&app, &user, resource, 4).await,
        StatusCode::CREATED
    );
    assert_eq!(
        book_hours(&app, &user, resource, 5).await,
        StatusCode::BAD_REQUEST
    );

    // Shorter than the minimum
    let start = tomorrow();
    let (status, body) = request(
        &app,
        "POST",
        "/reservations",
        Some(&user),
        Some(json!({
            "title": "Short",
            "occurrences": [{
                "resource_id": resource,
                "start_time": start,
                "end_time": start + Duration::minutes(30),
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("vähimmäiskesto"), "{body}");

    // Admins are exempt
    assert_eq!(
        book_hours(&app, &admin, resource, 8).await,
        StatusCode::CREATED
    );
}

#[sqlx::test]
async fn editing_checks_new_durations(pool: PgPool) {
    let (app, _, user, resource) = setup(pool).await;
    let start = tomorrow();
    let (_, created) = request(
        &app,
        "POST",
        "/reservations",
        Some(&user),
        Some(json!({
            "title": "Booking",
            "occurrences": [{
                "resource_id": resource,
                "start_time": start,
                "end_time": start + Duration::hours(2),
            }]
        })),
    )
    .await;
    let uri = format!("/reservations/{}", created["id"].as_str().unwrap());

    let (status, _) = request(
        &app,
        "PATCH",
        &uri,
        Some(&user),
        Some(json!({ "occurrences": [{
            "resource_id": resource,
            "start_time": start,
            "end_time": start + Duration::hours(6),
        }] })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn invalid_duration_config_is_rejected(pool: PgPool) {
    let (app, admin, _, resource) = setup(pool).await;
    let uri = format!("/resources/{resource}");

    // min above max (merged with the stored max of 240)
    let (status, _) = request(
        &app,
        "PATCH",
        &uri,
        Some(&admin),
        Some(json!({ "min_duration_minutes": 300 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // default above max
    let (status, _) = request(
        &app,
        "PATCH",
        &uri,
        Some(&admin),
        Some(json!({ "default_duration_minutes": 500 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Rejected updates leave the resource untouched
    let (_, resource) = request(&app, "GET", &uri, Some(&admin), None).await;
    assert_eq!(resource["min_duration_minutes"], 60);

    // Create validates too
    let (status, _) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({
            "collection_id": resource["collection_id"],
            "name": "Bad",
            "min_duration_minutes": 120,
            "max_duration_minutes": 60,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // 0 clears
    let (status, cleared) = request(
        &app,
        "PATCH",
        &uri,
        Some(&admin),
        Some(json!({ "max_duration_minutes": 0, "min_duration_minutes": 0 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(cleared["max_duration_minutes"].is_null());
    assert!(cleared["min_duration_minutes"].is_null());
    assert_eq!(cleared["default_duration_minutes"], 120);
}
