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

struct Env {
    app: Router,
    admin: String,
    /// User in the auto-confirmed group
    member: String,
    /// User in a different group
    other: String,
    /// Auto-confirm for `member_group` only
    group_only: Uuid,
    /// Auto-confirm for everyone
    everyone: Uuid,
    /// No auto-confirm
    manual: Uuid,
}

async fn create_resource(app: &Router, admin: &str, collection_id: Uuid, extra: Value) -> Uuid {
    let mut body =
        json!({ "collection_id": collection_id, "name": format!("R {}", Uuid::new_v4()) });
    body.as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    let (status, resource) = request(app, "POST", "/resources", Some(admin), Some(body)).await;
    assert_eq!(status, StatusCode::CREATED, "{resource}");
    resource["id"].as_str().unwrap().parse().unwrap()
}

async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let member_group = create_group(&pool).await;
    let (member, _) = setup_user_in_group(&pool, Role::User, member_group).await;
    let (other, _, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool.clone(), test_config());

    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let group_only = create_resource(
        &app,
        &admin,
        collection_id,
        json!({ "auto_confirm": true, "auto_confirm_group_ids": [member_group] }),
    )
    .await;
    let everyone =
        create_resource(&app, &admin, collection_id, json!({ "auto_confirm": true })).await;
    let manual = create_resource(&app, &admin, collection_id, json!({})).await;

    Env {
        app,
        admin,
        member,
        other,
        group_only,
        everyone,
        manual,
    }
}

async fn book(env: &Env, auth: &str, resources: &[Uuid], start: DateTime<Utc>) -> Value {
    let (status, created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(auth),
        Some(reservation(resources, start)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    created
}

#[sqlx::test]
async fn admin_sets_auto_confirm_groups(pool: PgPool) {
    let env = setup(pool.clone()).await;
    let new_group = create_group(&pool).await;

    let (_, resource) = request(
        &env.app,
        "GET",
        &format!("/resources/{}", env.group_only),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(resource["auto_confirm"], true);
    assert_eq!(
        resource["auto_confirm_group_ids"].as_array().unwrap().len(),
        1
    );

    let (status, updated) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.group_only),
        Some(&env.admin),
        Some(json!({ "auto_confirm_group_ids": [new_group] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["auto_confirm_group_ids"], json!([new_group]));
    assert_eq!(updated["auto_confirm"], true);

    let (_, updated) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.group_only),
        Some(&env.admin),
        Some(json!({ "auto_confirm": false })),
    )
    .await;
    assert_eq!(updated["auto_confirm"], false);
    assert_eq!(updated["auto_confirm_group_ids"], json!([new_group]));
}

#[sqlx::test]
async fn reservation_status_follows_auto_confirm(pool: PgPool) {
    let env = setup(pool).await;
    let start = tomorrow();

    // Member of the listed group: confirmed
    assert_eq!(
        book(&env, &env.member, &[env.group_only], start).await["status"],
        "confirmed"
    );
    // Other group: pending on the group-limited resource, confirmed on the open one
    assert_eq!(
        book(
            &env,
            &env.other,
            &[env.group_only],
            start + Duration::days(1)
        )
        .await["status"],
        "pending"
    );
    assert_eq!(
        book(&env, &env.other, &[env.everyone], start).await["status"],
        "confirmed"
    );
    // Resource without auto-confirm: pending
    assert_eq!(
        book(&env, &env.member, &[env.manual], start).await["status"],
        "pending"
    );
    // Mixed resources: every one must qualify
    assert_eq!(
        book(
            &env,
            &env.member,
            &[env.group_only, env.manual],
            start + Duration::days(2)
        )
        .await["status"],
        "pending"
    );
    // Admins keep choosing the status themselves
    let (_, admin_created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.admin),
        Some(json!({
            "title": "Admin",
            "status": "pending",
            "occurrences": [{
                "resource_id": env.everyone,
                "start_time": start + Duration::days(3),
                "end_time": start + Duration::days(3) + Duration::hours(1),
            }]
        })),
    )
    .await;
    assert_eq!(admin_created["status"], "pending");
}

#[sqlx::test]
async fn editing_keeps_auto_confirmed_status(pool: PgPool) {
    let env = setup(pool).await;
    let start = tomorrow();

    let created = book(&env, &env.member, &[env.group_only], start).await;
    let id = created["id"].as_str().unwrap();

    // Metadata-only edit stays confirmed
    let (status, edited) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{id}"),
        Some(&env.member),
        Some(json!({ "title": "Renamed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(edited["status"], "confirmed");

    // Moving it onto a resource that needs approval drops it back to pending
    let (status, edited) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{id}"),
        Some(&env.member),
        Some(json!({
            "occurrences": [{
                "resource_id": env.manual,
                "start_time": start,
                "end_time": start + Duration::hours(1),
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(edited["status"], "pending");
}
