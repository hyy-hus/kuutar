mod common;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};

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

#[sqlx::test]
async fn admin_manages_resource_color(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let app = app(pool, test_config());

    // Created without a color
    let (status, created) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({ "collection_id": collection_id, "name": "Sauna" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(created["color"].is_null());
    let id = created["id"].as_str().unwrap();

    // Invalid keys are rejected, on create as well
    let (status, _) = request(
        &app,
        "PATCH",
        &format!("/resources/{id}"),
        Some(&admin),
        Some(json!({ "color": "chartreuse" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status, _) = request(
        &app,
        "POST",
        "/resources",
        Some(&admin),
        Some(json!({ "collection_id": collection_id, "name": "X", "color": "nope" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);

    // Non-admins cannot set it
    let (status, _) = request(
        &app,
        "PATCH",
        &format!("/resources/{id}"),
        Some(&user),
        Some(json!({ "color": "red" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, updated) = request(
        &app,
        "PATCH",
        &format!("/resources/{id}"),
        Some(&admin),
        Some(json!({ "color": "teal" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["color"], "teal");

    // Other updates keep the color, and guests can read it
    let (_, renamed) = request(
        &app,
        "PATCH",
        &format!("/resources/{id}"),
        Some(&admin),
        Some(json!({ "name": "Sauna 2" })),
    )
    .await;
    assert_eq!(renamed["color"], "teal");
    let (status, fetched) = request(&app, "GET", &format!("/resources/{id}"), None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched["color"], "teal");

    // An empty string clears it
    let (status, cleared) = request(
        &app,
        "PATCH",
        &format!("/resources/{id}"),
        Some(&admin),
        Some(json!({ "color": "" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(cleared["color"].is_null());
}
