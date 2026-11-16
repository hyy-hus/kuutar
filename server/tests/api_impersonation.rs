use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use kuutar::{
    app,
    domains::{auth::jwt::decode_jwt, users::models::Role},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

mod common;

use common::{setup_user_in_group, setup_user_token, test_config};

async fn call(
    app: &Router,
    method: &str,
    uri: &str,
    bearer: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(b) = bearer {
        req = req.header(header::AUTHORIZATION, format!("Bearer {b}"));
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

struct Setup {
    app: Router,
    admin_id: Uuid,
    admin_token: String,
    user_id: Uuid,
}

/// An admin and a regular user in the same group. Tokens are without the "Bearer " prefix.
async fn setup(pool: &PgPool) -> Setup {
    let (admin_header, admin_id, group_id) = setup_user_token(pool, Role::Admin).await;
    let (_, user_id) = setup_user_in_group(pool, Role::User, group_id).await;
    Setup {
        app: app(pool.clone(), test_config()),
        admin_id,
        admin_token: admin_header.trim_start_matches("Bearer ").to_string(),
        user_id,
    }
}

/// Starts impersonating `user_id`, returning (access, refresh)
async fn impersonate(s: &Setup, user_id: Uuid) -> (String, String) {
    let (status, v) = call(
        &s.app,
        "POST",
        &format!("/auth/impersonate/{user_id}"),
        Some(&s.admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{v}");
    (
        v["access_token"].as_str().unwrap().to_string(),
        v["refresh_token"].as_str().unwrap().to_string(),
    )
}

#[sqlx::test]
async fn test_admin_can_act_as_user(pool: PgPool) {
    let s = setup(&pool).await;
    let (access, _) = impersonate(&s, s.user_id).await;

    let claims = decode_jwt(&access, &test_config().jwt_secret).unwrap();
    assert_eq!(claims.sub, s.user_id);
    assert_eq!(claims.role, Role::User);
    assert_eq!(claims.act, Some(s.admin_id));

    let (status, me) = call(&s.app, "GET", "/users/me", Some(&access), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["id"], json!(s.user_id));
    assert_eq!(me["impersonator"]["id"], json!(s.admin_id));

    // The admin's own profile has no impersonator
    let (_, me) = call(&s.app, "GET", "/users/me", Some(&s.admin_token), None).await;
    assert_eq!(me["impersonator"], Value::Null);

    // Admin endpoints are out of reach while acting as a regular user
    let (status, _) = call(&s.app, "GET", "/users", Some(&access), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn test_impersonation_targets_are_restricted(pool: PgPool) {
    let s = setup(&pool).await;
    let (_, other_admin_id, _) = setup_user_token(&pool, Role::Admin).await;

    // Not another admin, not yourself
    for target in [other_admin_id, s.admin_id] {
        let (status, _) = call(
            &s.app,
            "POST",
            &format!("/auth/impersonate/{target}"),
            Some(&s.admin_token),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::FORBIDDEN);
    }

    // Not a missing or deleted user
    let (status, _) = call(
        &s.app,
        "POST",
        &format!("/auth/impersonate/{}", Uuid::new_v4()),
        Some(&s.admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (user_header, deleted_id, _) = setup_user_token(&pool, Role::User).await;
    sqlx::query!(
        "UPDATE users SET deleted_at = NOW() WHERE id = $1",
        deleted_id
    )
    .execute(&pool)
    .await
    .unwrap();
    let (status, _) = call(
        &s.app,
        "POST",
        &format!("/auth/impersonate/{deleted_id}"),
        Some(&s.admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Regular users can't impersonate anyone
    let user_token = user_header.trim_start_matches("Bearer ");
    let (status, _) = call(
        &s.app,
        "POST",
        &format!("/auth/impersonate/{}", s.user_id),
        Some(user_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // No chaining from inside an impersonation session
    let (access, _) = impersonate(&s, s.user_id).await;
    let (status, _) = call(
        &s.app,
        "POST",
        &format!("/auth/impersonate/{}", s.user_id),
        Some(&access),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn test_account_actions_blocked_while_impersonating(pool: PgPool) {
    let s = setup(&pool).await;
    let (access, _) = impersonate(&s, s.user_id).await;

    for (method, uri, body) in [
        ("GET", "/auth/sessions", None),
        ("POST", "/auth/logout-others", None),
        (
            "DELETE",
            &format!("/auth/sessions/{}", Uuid::new_v4()) as &str,
            None,
        ),
        ("DELETE", "/users/me", None),
        (
            "PATCH",
            "/users/me",
            Some(json!({"email": "taken-over@example.com"})),
        ),
        (
            "PATCH",
            "/users/me",
            Some(json!({"password": "newpassword123"})),
        ),
    ] {
        let (status, _) = call(&s.app, method, uri, Some(&access), body).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {uri}");
    }

    let user_email: String =
        sqlx::query_scalar!("SELECT email FROM users WHERE id = $1", s.user_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    // Profile details other than credentials can be edited (sending the unchanged email is
    // fine, as the profile form does), and the response keeps the
    // impersonator so the client's cached profile stays correct
    let (status, me) = call(
        &s.app,
        "PATCH",
        "/users/me",
        Some(&access),
        Some(json!({"language": "en", "email": user_email.to_uppercase()})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["language"], "en");
    assert_eq!(me["impersonator"]["id"], json!(s.admin_id));

    // The user still exists
    let deleted: Option<chrono::DateTime<Utc>> =
        sqlx::query_scalar!("SELECT deleted_at FROM users WHERE id = $1", s.user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(deleted.is_none());
}

#[sqlx::test]
async fn test_refresh_keeps_impersonation_until_cap(pool: PgPool) {
    let s = setup(&pool).await;
    let (_, refresh) = impersonate(&s, s.user_id).await;

    let (status, v) = call(
        &s.app,
        "POST",
        "/auth/refresh",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let access = v["access_token"].as_str().unwrap();
    let refresh = v["refresh_token"].as_str().unwrap().to_string();
    let claims = decode_jwt(access, &test_config().jwt_secret).unwrap();
    assert_eq!(claims.act, Some(s.admin_id));

    // The refresh token never outlives the one-hour cap
    let max_expiry: chrono::DateTime<Utc> = sqlx::query_scalar!(
        "SELECT MAX(expires_at) FROM refresh_tokens WHERE impersonator_id = $1",
        s.admin_id
    )
    .fetch_one(&pool)
    .await
    .unwrap()
    .unwrap();
    assert!(max_expiry <= Utc::now() + Duration::minutes(61));

    // Past the cap, the token has expired
    sqlx::query!(
        "UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE impersonator_id = $1",
        s.admin_id
    )
    .execute(&pool)
    .await
    .unwrap();
    let (status, _) = call(
        &s.app,
        "POST",
        "/auth/refresh",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_refresh_fails_after_admin_demoted(pool: PgPool) {
    let s = setup(&pool).await;
    let (_, refresh) = impersonate(&s, s.user_id).await;

    sqlx::query!("UPDATE users SET role = 'user' WHERE id = $1", s.admin_id)
        .execute(&pool)
        .await
        .unwrap();

    let (status, _) = call(
        &s.app,
        "POST",
        "/auth/refresh",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_end_impersonation(pool: PgPool) {
    let s = setup(&pool).await;
    let (_, refresh) = impersonate(&s, s.user_id).await;

    let (status, _) = call(
        &s.app,
        "POST",
        "/auth/impersonate/end",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _) = call(
        &s.app,
        "POST",
        "/auth/refresh",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let reason: Option<String> = sqlx::query_scalar!(
        "SELECT revoked_reason FROM refresh_tokens WHERE impersonator_id = $1",
        s.admin_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reason.as_deref(), Some("impersonation_end"));
}

#[sqlx::test]
async fn test_end_impersonation_ignores_normal_sessions(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let group_id = common::create_group(&pool).await;
    let (status, v) = call(
        &app,
        "POST",
        "/auth/register",
        None,
        Some(json!({
            "group_id": group_id, "name": "Normal User", "email": "normal@example.com",
            "password": "securepassword123"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let refresh = v["refresh_token"].as_str().unwrap();

    let (status, _) = call(
        &app,
        "POST",
        "/auth/impersonate/end",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // The normal session is still alive
    let (status, _) = call(
        &app,
        "POST",
        "/auth/refresh",
        None,
        Some(json!({"refresh_token": refresh})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}

#[sqlx::test]
async fn test_admin_sees_impersonation_session(pool: PgPool) {
    let s = setup(&pool).await;
    impersonate(&s, s.user_id).await;

    let (status, sessions) = call(
        &s.app,
        "GET",
        &format!("/users/{}/sessions", s.user_id),
        Some(&s.admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let sessions = sessions.as_array().unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0]["impersonated_by"], json!(s.admin_id));
}

#[sqlx::test]
async fn test_reservation_made_while_impersonating_belongs_to_user(pool: PgPool) {
    let s = setup(&pool).await;
    let collection_id: Uuid = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ('Imp collection') RETURNING id"
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let resource_id: Uuid = sqlx::query_scalar!(
        "INSERT INTO resources (collection_id, name) VALUES ($1, 'Imp resource') RETURNING id",
        collection_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let (access, _) = impersonate(&s, s.user_id).await;
    let start = Utc::now() + Duration::hours(1);
    let (status, v) = call(
        &s.app,
        "POST",
        "/reservations",
        Some(&access),
        Some(json!({
            "title": "Made by support",
            "description": {"fi": {"type": "doc", "content": []}},
            "occurrences": [{
                "resource_id": resource_id,
                "start_time": start,
                "end_time": start + Duration::hours(1)
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{v}");
    assert_eq!(v["user_id"], json!(s.user_id));
}
