use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use kuutar::app;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

mod common;

use common::{create_group, setup_admin_token, test_config};

async fn call(
    app: &Router,
    method: &str,
    uri: &str,
    bearer: Option<&str>,
    user_agent: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(b) = bearer {
        req = req.header(header::AUTHORIZATION, format!("Bearer {b}"));
    }
    if let Some(ua) = user_agent {
        req = req.header(header::USER_AGENT, ua);
    }
    let req = match body {
        Some(b) => req
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(b.to_string())),
        None => req.body(Body::empty()),
    }
    .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, value)
}

struct Login {
    access: String,
    refresh: String,
}

fn tokens(v: &Value) -> Login {
    Login {
        access: v["access_token"].as_str().unwrap().to_string(),
        refresh: v["refresh_token"].as_str().unwrap().to_string(),
    }
}

async fn register(app: &Router, pool: &PgPool, email: &str) -> (Uuid, Login) {
    let group_id = create_group(pool).await;
    let (status, v) = call(
        app,
        "POST",
        "/auth/register",
        None,
        Some("Firefox/Linux"),
        Some(json!({
            "group_id": group_id, "name": "Sess User", "email": email,
            "password": "securepassword123"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let user_id = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email)
        .fetch_one(pool)
        .await
        .unwrap();
    (user_id, tokens(&v))
}

async fn login(app: &Router, email: &str, ua: &str) -> Login {
    let (status, v) = call(
        app,
        "POST",
        "/auth/login",
        None,
        Some(ua),
        Some(json!({"email": email, "password": "securepassword123"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    tokens(&v)
}

async fn refresh(app: &Router, token: &str) -> (StatusCode, Value) {
    call(
        app,
        "POST",
        "/auth/refresh",
        None,
        None,
        Some(json!({"refresh_token": token})),
    )
    .await
}

#[sqlx::test]
async fn test_rotation_keeps_session_and_lists_it(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let (_, first) = register(&app, &pool, "rot@example.com").await;

    let (status, v) = refresh(&app, &first.refresh).await;
    assert_eq!(status, StatusCode::OK);
    let second = tokens(&v);

    let (status, sessions) = call(
        &app,
        "GET",
        "/auth/sessions",
        Some(&second.access),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let sessions = sessions.as_array().unwrap();
    assert_eq!(sessions.len(), 1, "rotation must not create a new session");
    assert_eq!(sessions[0]["current"], true);
    assert_eq!(sessions[0]["user_agent"], "Firefox/Linux");
}

#[sqlx::test]
async fn test_reuse_after_grace_revokes_session(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let (_, first) = register(&app, &pool, "reuse@example.com").await;

    let (_, v) = refresh(&app, &first.refresh).await;
    let second = tokens(&v);

    // Replay within the grace window: rejected, but the session survives (tab race)
    assert_eq!(
        refresh(&app, &first.refresh).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(refresh(&app, &second.refresh).await.0, StatusCode::OK);
}

#[sqlx::test]
async fn test_reuse_outside_grace_kills_whole_chain(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let (_, first) = register(&app, &pool, "theft@example.com").await;

    let (_, v) = refresh(&app, &first.refresh).await;
    let second = tokens(&v);

    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '5 minutes' WHERE revoked_reason = 'rotated'"
    )
    .execute(&pool)
    .await
    .unwrap();

    // Replaying the old token revokes the legitimate chain too
    assert_eq!(
        refresh(&app, &first.refresh).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        refresh(&app, &second.refresh).await.0,
        StatusCode::UNAUTHORIZED
    );
}

#[sqlx::test]
async fn test_user_manages_own_sessions(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let (_, laptop) = register(&app, &pool, "own@example.com").await;
    let phone = login(&app, "own@example.com", "Safari/iOS").await;

    let (_, list) = call(
        &app,
        "GET",
        "/auth/sessions",
        Some(&laptop.access),
        None,
        None,
    )
    .await;
    let list = list.as_array().unwrap();
    assert_eq!(list.len(), 2);
    let phone_id = list
        .iter()
        .find(|s| s["user_agent"] == "Safari/iOS")
        .unwrap()["session_id"]
        .as_str()
        .unwrap()
        .to_string();

    // End the phone session
    let (status, _) = call(
        &app,
        "DELETE",
        &format!("/auth/sessions/{phone_id}"),
        Some(&laptop.access),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        refresh(&app, &phone.refresh).await.0,
        StatusCode::UNAUTHORIZED
    );

    // Ending it again, or someone else's session, is a 404
    let (status, _) = call(
        &app,
        "DELETE",
        &format!("/auth/sessions/{phone_id}"),
        Some(&laptop.access),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // logout-others spares the current session
    let tablet = login(&app, "own@example.com", "Chrome/Android").await;
    let (status, _) = call(
        &app,
        "POST",
        "/auth/logout-others",
        Some(&laptop.access),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        refresh(&app, &tablet.refresh).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(refresh(&app, &laptop.refresh).await.0, StatusCode::OK);
}

#[sqlx::test]
async fn test_admin_manages_user_sessions(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let admin = setup_admin_token(&pool).await;
    let admin = admin.strip_prefix("Bearer ").unwrap().to_string();
    let (user_id, a) = register(&app, &pool, "target@example.com").await;
    let b = login(&app, "target@example.com", "Safari/iOS").await;

    // Non-admins cannot use the admin endpoints
    let (status, _) = call(
        &app,
        "GET",
        &format!("/users/{user_id}/sessions"),
        Some(&a.access),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, list) = call(
        &app,
        "GET",
        &format!("/users/{user_id}/sessions"),
        Some(&admin),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let list = list.as_array().unwrap();
    assert_eq!(list.len(), 2);
    let one = list[0]["session_id"].as_str().unwrap().to_string();

    let (status, _) = call(
        &app,
        "DELETE",
        &format!("/users/{user_id}/sessions/{one}"),
        Some(&admin),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let alive = [&a, &b]
        .into_iter()
        .map(|l| refresh(&app, &l.refresh))
        .collect::<Vec<_>>();
    let mut ok = 0;
    for f in alive {
        if f.await.0 == StatusCode::OK {
            ok += 1;
        }
    }
    assert_eq!(ok, 1, "exactly one session should remain");

    // Revoke everything
    let (status, _) = call(
        &app,
        "DELETE",
        &format!("/users/{user_id}/sessions"),
        Some(&admin),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, list) = call(
        &app,
        "GET",
        &format!("/users/{user_id}/sessions"),
        Some(&admin),
        None,
        None,
    )
    .await;
    assert!(list.as_array().unwrap().is_empty());
}

#[sqlx::test]
async fn test_password_change_revokes_sessions(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let admin = setup_admin_token(&pool).await;
    let admin = admin.strip_prefix("Bearer ").unwrap().to_string();
    let (user_id, a) = register(&app, &pool, "pw@example.com").await;
    let b = login(&app, "pw@example.com", "Safari/iOS").await;

    // Own password change keeps only the current session
    let (status, _) = call(
        &app,
        "PATCH",
        "/users/me",
        Some(&a.access),
        None,
        Some(json!({"password": "anothersecurepw456"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(refresh(&app, &b.refresh).await.0, StatusCode::UNAUTHORIZED);
    let (status, v) = refresh(&app, &a.refresh).await;
    assert_eq!(status, StatusCode::OK);
    let a = tokens(&v);

    // Admin reset ends all of them
    let (status, _) = call(
        &app,
        "PATCH",
        &format!("/users/{user_id}"),
        Some(&admin),
        None,
        Some(json!({"password": "yetanotherpw789"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(refresh(&app, &a.refresh).await.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_session_has_absolute_lifetime(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let (user_id, first) = register(&app, &pool, "cap@example.com").await;

    // Session started almost 30 days ago
    sqlx::query!(
        "UPDATE refresh_tokens SET session_started_at = NOW() - INTERVAL '29 days 23 hours' WHERE user_id = $1",
        user_id
    )
    .execute(&pool)
    .await
    .unwrap();

    let (status, _) = refresh(&app, &first.refresh).await;
    assert_eq!(status, StatusCode::OK);

    // The new token expires with the session, not 7 days out
    let hours_left = sqlx::query_scalar!(
        r#"SELECT (EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600)::float8 AS "h!"
           FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL"#,
        user_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(hours_left < 2.0, "expected <2h left, got {hours_left}");
}
