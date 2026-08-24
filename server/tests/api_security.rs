use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use kuutar::app;
use serde_json::json;
use sqlx::PgPool;
use tower::ServiceExt;

mod common;

use common::{setup_user_token, test_config};
use kuutar::domains::users::models::Role;

#[sqlx::test]
async fn test_admin_routes_rbac_matrix(pool: PgPool) {
    let app = app(pool.clone(), test_config());

    let (user_auth, _, _) = setup_user_token(&pool, Role::User).await;
    let (admin_auth, _, _) = setup_user_token(&pool, Role::Admin).await;

    let admin_endpoints = vec![
        (
            "POST",
            "/collections",
            json!({ "name": "Security Test Collection" }),
        ),
        ("POST", "/groups", json!({ "name": "Security Test Group" })),
        (
            "POST",
            "/resources",
            json!({ "name": "Security Test Resource" }),
        ),
    ];

    for (method, uri, body) in admin_endpoints {
        // 1. Unauthenticated -> 401
        let req = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            res.status(),
            StatusCode::UNAUTHORIZED,
            "Endpoint {method} {uri} should require authentication"
        );

        // 2. Regular User (Role::User) -> 403 Forbidden
        let req = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, &user_auth)
            .body(Body::from(body.to_string()))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            res.status(),
            StatusCode::FORBIDDEN,
            "Endpoint {method} {uri} should forbid regular users"
        );

        // 3. Admin User (Role::Admin) -> 201 Created / Success
        let req = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, &admin_auth)
            .body(Body::from(body.to_string()))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_ne!(
            res.status(),
            StatusCode::FORBIDDEN,
            "Endpoint {method} {uri} should allow admins"
        );
        assert_ne!(
            res.status(),
            StatusCode::UNAUTHORIZED,
            "Endpoint {method} {uri} should allow admins"
        );
    }
}
