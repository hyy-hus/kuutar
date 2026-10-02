mod common;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use common::{setup_admin_token, setup_user_token, test_config};
use kuutar::{app, domains::users::models::Role};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

async fn call(
    app: axum::Router,
    method: &str,
    uri: &str,
    token: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let response = app
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header(header::AUTHORIZATION, token)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.map(|b| b.to_string()).unwrap_or_default()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

fn doc(text: &str) -> Value {
    json!({"type": "doc", "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": text}]}
    ]})
}

#[sqlx::test]
async fn test_requires_admin(pool: PgPool) {
    let (token, _, _) = setup_user_token(&pool, Role::User).await;
    let app = app(pool, test_config());

    let (status, _) = call(app, "GET", "/email-templates", &token, None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn test_lists_defaults_until_customized(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());

    let (status, body) = call(app, "GET", "/email-templates", &token, None).await;
    assert_eq!(status, StatusCode::OK);

    let templates = body.as_array().unwrap();
    assert_eq!(templates.len(), 4);
    for template in templates {
        assert_eq!(template["customized"], json!(false));
        for lang in ["fi", "sv", "en"] {
            assert!(template["subject"][lang].is_string());
            assert_eq!(template["body"][lang]["type"], json!("doc"));
        }
    }
}

#[sqlx::test]
async fn test_save_override_then_reset(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());
    let uri = "/email-templates/reservation_confirmed";

    let (status, saved) = call(
        app.clone(),
        "PUT",
        uri,
        &token,
        Some(json!({
            "subject": {"fi": "Vahvistettu!"},
            "body": {"fi": doc("Oma teksti")}
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(saved["customized"], json!(true));
    assert_eq!(saved["subject"]["fi"], json!("Vahvistettu!"));
    // Languages that were not overridden keep the built-in default
    assert!(saved["subject"]["en"].is_string());

    let (status, reset) = call(app, "DELETE", uri, &token, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(reset["customized"], json!(false));
    assert_ne!(reset["subject"]["fi"], json!("Vahvistettu!"));
}

#[sqlx::test]
async fn test_rejects_invalid_template(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());
    let uri = "/email-templates/reservation_created";

    for payload in [
        json!({"subject": {"fi": ""}, "body": {}}),
        json!({"subject": {"xx": "Hei"}, "body": {}}),
        json!({"subject": {"fi": "a\nb"}, "body": {}}),
        json!({"subject": {}, "body": {"fi": "<p>html</p>"}}),
    ] {
        let (status, _) = call(app.clone(), "PUT", uri, &token, Some(payload)).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }
}

#[sqlx::test]
async fn test_unknown_template_key_is_rejected(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());

    let (status, _) = call(app, "GET", "/email-templates/nope", &token, None).await;
    assert!(status.is_client_error());
}

#[sqlx::test]
async fn test_preview_renders_unsaved_edits_with_sample_data(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());

    let (status, preview) = call(
        app,
        "POST",
        "/email-templates/reservation_created/preview",
        &token,
        Some(json!({
            "language": "fi",
            "subject": {"fi": "Uusi: {{title}}"},
            "body": {"fi": doc("Moi {{user_name}} <b>")}
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(preview["subject"], json!("Uusi: Kokous"));
    let html = preview["html"].as_str().unwrap();
    assert!(html.contains("Moi Matti Meikäläinen &lt;b&gt;"));
    assert!(!html.contains("<b>"));
}

#[sqlx::test]
async fn test_send_test_requires_smtp_configuration(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());

    let (status, _) = call(
        app,
        "POST",
        "/email-templates/reservation_created/send-test",
        &token,
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn test_welcome_template_previews_with_user_variables(pool: PgPool) {
    let token = setup_admin_token(&pool).await;
    let app = app(pool, test_config());

    let (status, template) = call(
        app.clone(),
        "GET",
        "/email-templates/user_welcome",
        &token,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        template["variables"],
        json!(["user_name", "email", "app_url"])
    );

    let (status, preview) = call(
        app,
        "POST",
        "/email-templates/user_welcome/preview",
        &token,
        Some(json!({"language": "en"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(preview["subject"], json!("Welcome to Kuutar"));
    assert!(
        preview["html"]
            .as_str()
            .unwrap()
            .contains("matti@example.com")
    );
    assert!(
        preview["html"]
            .as_str()
            .unwrap()
            .contains(r#"href="http://localhost:5173""#)
    );
}
