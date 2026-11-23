//! Rate limits on the auth endpoints (#111)

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
    response::Response,
};
use kuutar::{app, domains::auth::password};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

mod common;

use common::{create_group, test_config};

async fn post(app: &Router, uri: &str, ip: &str, body: Value) -> Response {
    let req = Request::builder()
        .method("POST")
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .header("x-forwarded-for", ip)
        .body(Body::from(body.to_string()))
        .unwrap();
    app.clone().oneshot(req).await.unwrap()
}

async fn login(app: &Router, ip: &str, email: &str, password: &str) -> Response {
    post(
        app,
        "/auth/login",
        ip,
        json!({ "email": email, "password": password }),
    )
    .await
}

async fn create_user(pool: &PgPool, email: &str, pw: &str) {
    let group_id = create_group(pool).await;
    let hash = password::hash_password(pw).unwrap();
    sqlx::query("INSERT INTO users (group_id, email, password_hash) VALUES ($1, $2, $3)")
        .bind(group_id)
        .bind(email)
        .bind(hash)
        .execute(pool)
        .await
        .unwrap();
}

fn retry_after(res: &Response) -> u64 {
    res.headers()[header::RETRY_AFTER]
        .to_str()
        .unwrap()
        .parse()
        .unwrap()
}

#[sqlx::test]
async fn login_is_locked_after_ten_failures_for_an_email(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    create_user(&pool, "user@example.test", "right-password").await;

    for i in 0..10 {
        // Different addresses, so only the per-email limit applies
        let res = login(&app, &format!("198.51.100.{i}"), "user@example.test", "wrong").await;
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    // Even the right password is refused now, and the email's case doesn't matter
    let res = login(&app, "198.51.100.99", "USER@example.test", "right-password").await;
    assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);
    let secs = retry_after(&res);
    assert!(secs > 0 && secs <= 15 * 60, "Retry-After was {secs}");
}

#[sqlx::test]
async fn successful_login_clears_the_email_counter(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    create_user(&pool, "user@example.test", "right-password").await;

    for _ in 0..9 {
        login(&app, "198.51.100.1", "user@example.test", "wrong").await;
    }
    let res = login(&app, "198.51.100.1", "user@example.test", "right-password").await;
    assert_eq!(res.status(), StatusCode::OK);

    // The counter starts over, so nine more failures are still answered normally
    for _ in 0..9 {
        let res = login(&app, "198.51.100.1", "user@example.test", "wrong").await;
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }
}

#[sqlx::test]
async fn unknown_emails_count_too(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    for i in 0..10 {
        login(&app, &format!("198.51.100.{i}"), "nobody@example.test", "x").await;
    }
    let res = login(&app, "198.51.100.99", "nobody@example.test", "x").await;
    assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[sqlx::test]
async fn login_per_ip_limit_spans_emails_and_uses_the_rightmost_forwarded_entry(pool: PgPool) {
    let app = app(pool.clone(), test_config());

    // The client forges the first entry differently each time; the proxy's entry stays put
    for i in 0..50 {
        let res = login(
            &app,
            &format!("10.9.9.{i}, 203.0.113.7"),
            &format!("user{i}@example.test"),
            "wrong",
        )
        .await;
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }
    let res = login(&app, "10.9.9.200, 203.0.113.7", "other@example.test", "x").await;
    assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);

    // Another address is unaffected
    let res = login(&app, "203.0.113.8", "other@example.test", "x").await;
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn otp_requests_are_limited_per_email_whether_or_not_it_exists(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    create_user(&pool, "user@example.test", "pw").await;

    for email in ["user@example.test", "nobody@example.test"] {
        for i in 0..3 {
            let res = post(
                &app,
                "/auth/otp/request",
                &format!("198.51.100.{i}"),
                json!({ "email": email }),
            )
            .await;
            assert_eq!(res.status(), StatusCode::OK, "{email} request {i}");
        }
        let res = post(
            &app,
            "/auth/otp/request",
            "198.51.100.50",
            json!({ "email": email }),
        )
        .await;
        assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS, "{email}");
        assert!(res.headers().contains_key(header::RETRY_AFTER));
    }
}

#[sqlx::test]
async fn registrations_are_limited_per_ip(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    let group_id = create_group(&pool).await;

    let register = |n: u32| {
        post(
            &app,
            "/auth/register",
            "203.0.113.7",
            json!({
                "group_id": group_id,
                "name": "Test User",
                "email": format!("new{n}-{}@example.test", Uuid::new_v4()),
                "password": "securepassword123"
            }),
        )
    };
    for n in 0..10 {
        assert_eq!(register(n).await.status(), StatusCode::CREATED);
    }
    assert_eq!(register(10).await.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[sqlx::test]
async fn sessions_record_the_proxy_reported_ip(pool: PgPool) {
    let app = app(pool.clone(), test_config());
    create_user(&pool, "user@example.test", "pw").await;

    let res = login(&app, "1.1.1.1, 203.0.113.7", "user@example.test", "pw").await;
    assert_eq!(res.status(), StatusCode::OK);

    let ip: Option<String> =
        sqlx::query_scalar("SELECT ip FROM refresh_tokens ORDER BY created_at DESC LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(ip.as_deref(), Some("203.0.113.7"));
}
