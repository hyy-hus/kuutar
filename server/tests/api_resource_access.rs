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

struct Env {
    app: Router,
    admin: String,
    /// User in the group that is granted access
    granted: String,
    /// User in a different group
    other: String,
    restricted: Uuid,
    open: Uuid,
    granted_group: Uuid,
}

/// A restricted resource granted to one group, plus an unrestricted resource
async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let granted_group = create_group(&pool).await;
    let (granted, _) = setup_user_in_group(&pool, Role::User, granted_group).await;
    let (other, _, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool.clone(), test_config());

    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let (status, restricted) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({
            "collection_id": collection_id,
            "name": "Restricted",
            "reservation_restricted": true,
            "group_ids": [granted_group],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{restricted}");

    let (status, open) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({ "collection_id": collection_id, "name": "Open" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    Env {
        app,
        admin,
        granted,
        other,
        restricted: restricted["id"].as_str().unwrap().parse().unwrap(),
        open: open["id"].as_str().unwrap().parse().unwrap(),
        granted_group,
    }
}

fn tomorrow() -> DateTime<Utc> {
    Utc::now() + Duration::days(1)
}

#[sqlx::test]
async fn admin_sets_flag_and_replaces_groups(pool: PgPool) {
    let env = setup(pool.clone()).await;
    let new_group = create_group(&pool).await;

    let (status, resource) = request(
        &env.app,
        "GET",
        &format!("/resources/{}", env.restricted),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(resource["reservation_restricted"], true);
    assert_eq!(resource["reservable_group_ids"], json!([env.granted_group]));

    // Replace-all, and omitting group_ids leaves the set alone
    let (status, updated) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.restricted),
        Some(&env.admin),
        Some(json!({ "group_ids": [new_group] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["reservable_group_ids"], json!([new_group]));

    let (status, updated) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.restricted),
        Some(&env.admin),
        Some(json!({ "reservation_restricted": false })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["reservation_restricted"], false);
    assert_eq!(updated["reservable_group_ids"], json!([new_group]));

    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.restricted),
        Some(&env.granted),
        Some(json!({ "reservation_restricted": true })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn only_granted_group_can_reserve(pool: PgPool) {
    let env = setup(pool).await;

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.granted),
        Some(reservation(&[env.restricted], tomorrow())),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.other),
        Some(reservation(
            &[env.restricted],
            tomorrow() + Duration::days(1),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // Admins bypass the grant
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.admin),
        Some(reservation(
            &[env.restricted],
            tomorrow() + Duration::days(2),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
}

#[sqlx::test]
async fn unrestricted_resources_are_unaffected(pool: PgPool) {
    let env = setup(pool).await;

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.other),
        Some(reservation(&[env.open], tomorrow())),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
}

#[sqlx::test]
async fn multi_resource_reservation_rejected_if_any_is_denied(pool: PgPool) {
    let env = setup(pool).await;

    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.other),
        Some(reservation(&[env.open, env.restricted], tomorrow())),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn everyone_still_sees_restricted_resource_and_its_reservations(pool: PgPool) {
    let env = setup(pool).await;
    let start = tomorrow();

    let (status, created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.granted),
        Some(reservation(&[env.restricted], start)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    // Pending reservations are hidden from non-admins, so confirm it first
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{}", created["id"].as_str().unwrap()),
        Some(&env.admin),
        Some(json!({ "status": "confirmed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Guest: sees the resource, cannot reserve it
    let (status, list) = request(&env.app, "GET", "/resources", None, None).await;
    assert_eq!(status, StatusCode::OK);
    let entry = list
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == json!(env.restricted))
        .expect("restricted resource is listed for guests");
    assert_eq!(entry["can_reserve"], false);

    // Non-granted user: same, and can_reserve is true for the unrestricted one
    let (_, list) = request(&env.app, "GET", "/resources", Some(&env.other), None).await;
    for r in list.as_array().unwrap() {
        let expected = r["id"] != json!(env.restricted);
        assert_eq!(r["can_reserve"], expected, "{}", r["name"]);
    }

    // Granted user and admin can reserve
    for token in [&env.granted, &env.admin] {
        let (_, one) = request(
            &env.app,
            "GET",
            &format!("/resources/{}", env.restricted),
            Some(token),
            None,
        )
        .await;
        assert_eq!(one["can_reserve"], true);
    }

    // Reservations on the resource are visible to a non-granted user
    let uri = format!(
        "/reservations?resource_id={}&start_date={}&end_date={}",
        env.restricted,
        (start - Duration::days(1)).to_rfc3339().replace('+', "%2B"),
        (start + Duration::days(1)).to_rfc3339().replace('+', "%2B"),
    );
    let (status, reservations) = request(&env.app, "GET", &uri, Some(&env.other), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(reservations.as_array().unwrap().len(), 1);
}

#[sqlx::test]
async fn revoking_access_does_not_touch_existing_reservations(pool: PgPool) {
    let env = setup(pool.clone()).await;
    let start = tomorrow();

    let (status, created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.granted),
        Some(reservation(&[env.restricted], start)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = created["id"].as_str().unwrap();

    // Revoke: restricted with no groups
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/resources/{}", env.restricted),
        Some(&env.admin),
        Some(json!({ "group_ids": [] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Editing the existing reservation (same resource, new time) still works
    let moved = start + Duration::hours(3);
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{id}"),
        Some(&env.granted),
        Some(json!({
            "title": "Renamed",
            "occurrences": [{
                "resource_id": env.restricted,
                "start_time": moved,
                "end_time": moved + Duration::hours(1),
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // ...but adding a freshly denied resource on the user's reservation does not
    let (status, other_created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.granted),
        Some(reservation(&[env.open], start + Duration::days(3))),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let other_id = other_created["id"].as_str().unwrap();
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{other_id}"),
        Some(&env.granted),
        Some(reservation(
            &[env.open, env.restricted],
            start + Duration::days(3),
        )),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // Cancelling is unaffected
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/reservations/{id}/cancel"),
        Some(&env.granted),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}
