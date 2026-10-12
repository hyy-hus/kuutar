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
    /// User in the group listed under `visibility_group_ids`
    viewer: String,
    /// User in the group that may reserve (but is not a visibility group)
    reserver: String,
    /// User in an unrelated group
    other: String,
    hidden: Uuid,
    visibility_group: Uuid,
}

/// A non-public resource visible to one group and reservable by another
async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let visibility_group = create_group(&pool).await;
    let reserve_group = create_group(&pool).await;
    let (viewer, _) = setup_user_in_group(&pool, Role::User, visibility_group).await;
    let (reserver, _) = setup_user_in_group(&pool, Role::User, reserve_group).await;
    let (other, _, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool.clone(), test_config());

    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let (status, hidden) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({
            "collection_id": collection_id,
            "name": "Hidden",
            "is_public": false,
            "visibility_group_ids": [visibility_group],
            "reservation_restricted": true,
            "group_ids": [reserve_group],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{hidden}");

    Env {
        app,
        admin,
        viewer,
        reserver,
        other,
        hidden: hidden["id"].as_str().unwrap().parse().unwrap(),
        visibility_group,
    }
}

async fn is_listed(env: &Env, auth: Option<&str>) -> bool {
    let (status, list) = request(&env.app, "GET", "/resources", auth, None).await;
    assert_eq!(status, StatusCode::OK);
    list.as_array()
        .unwrap()
        .iter()
        .any(|r| r["id"] == json!(env.hidden))
}

async fn fetch_status(env: &Env, auth: Option<&str>) -> StatusCode {
    request(
        &env.app,
        "GET",
        &format!("/resources/{}", env.hidden),
        auth,
        None,
    )
    .await
    .0
}

#[sqlx::test]
async fn non_public_resource_visible_to_visibility_reserve_groups_and_admin(pool: PgPool) {
    let env = setup(pool).await;

    for token in [&env.admin, &env.viewer, &env.reserver] {
        assert!(is_listed(&env, Some(token)).await);
        assert_eq!(fetch_status(&env, Some(token)).await, StatusCode::OK);
    }

    assert!(!is_listed(&env, Some(&env.other)).await);
    assert!(!is_listed(&env, None).await);
    assert_eq!(
        fetch_status(&env, Some(&env.other)).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(fetch_status(&env, None).await, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn visibility_groups_are_exposed_replaced_and_kept_when_omitted(pool: PgPool) {
    let env = setup(pool.clone()).await;
    let new_group = create_group(&pool).await;
    let uri = format!("/resources/{}", env.hidden);

    let (_, resource) = request(&env.app, "GET", &uri, Some(&env.admin), None).await;
    assert_eq!(resource["is_public"], false);
    assert_eq!(resource["visible_group_ids"], json!([env.visibility_group]));

    // Omitting the field keeps the set
    let (status, resource) = request(
        &env.app,
        "PATCH",
        &uri,
        Some(&env.admin),
        Some(json!({ "name": "Renamed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(resource["visible_group_ids"], json!([env.visibility_group]));

    // Replacing swaps the set, so the previous group loses sight of it
    let (status, resource) = request(
        &env.app,
        "PATCH",
        &uri,
        Some(&env.admin),
        Some(json!({ "visibility_group_ids": [new_group] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(resource["visible_group_ids"], json!([new_group]));
    assert!(!is_listed(&env, Some(&env.viewer)).await);

    // Making it public shows it to everyone, guests included
    let (status, _) = request(
        &env.app,
        "PATCH",
        &uri,
        Some(&env.admin),
        Some(json!({ "is_public": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(is_listed(&env, None).await);
}

#[sqlx::test]
async fn hidden_resource_cannot_be_reserved_by_uuid(pool: PgPool) {
    let env = setup(pool).await;
    let start = Utc::now() + Duration::days(1);

    // Cannot see it, so cannot reserve it even knowing the id
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.other),
        Some(reservation(&[env.hidden], start)),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // A visibility-only group sees it but is not allowed to reserve it
    let (status, _) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.viewer),
        Some(reservation(&[env.hidden], start)),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // The reserve group sees and can reserve it
    let (status, body) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.reserver),
        Some(reservation(&[env.hidden], start)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
}

#[sqlx::test]
async fn calendar_hides_occurrences_on_resources_the_viewer_cannot_see(pool: PgPool) {
    let env = setup(pool).await;
    let start = Utc::now() + Duration::days(1);

    let (status, created) = request(
        &env.app,
        "POST",
        "/reservations",
        Some(&env.reserver),
        Some(reservation(&[env.hidden], start)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = request(
        &env.app,
        "PATCH",
        &format!("/reservations/{}", created["id"].as_str().unwrap()),
        Some(&env.admin),
        Some(json!({ "status": "confirmed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let uri = format!(
        "/reservations?start_date={}&end_date={}",
        (start - Duration::days(1)).to_rfc3339().replace('+', "%2B"),
        (start + Duration::days(2)).to_rfc3339().replace('+', "%2B"),
    );
    for (token, expected) in [
        (Some(&env.viewer), 1),
        (Some(&env.reserver), 1),
        (Some(&env.admin), 1),
        (Some(&env.other), 0),
        (None, 0),
    ] {
        let (status, list) =
            request(&env.app, "GET", &uri, token.map(String::as_str), None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(list.as_array().unwrap().len(), expected);
    }
}
