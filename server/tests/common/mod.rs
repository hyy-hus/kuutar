use kuutar::{config::Config, domains::auth::jwt, domains::users::models::Role};
use sqlx::PgPool;
use uuid::Uuid;

pub fn test_config() -> Config {
    Config {
        database_url: "postgres://postgres:postgres@localhost:5432/test_db".to_string(),
        bind_addr: "127.0.0.1:0".parse().expect("valid socket address"),
        max_db_connections: 5,
        jwt_secret: "test_secret_key_12345_super_secret".to_string(),
        jwt_expiration_seconds: 900,
    }
}

/// Creates a test group and user with the given role, returning a valid Bearer token header string.
pub async fn setup_user_token(pool: &PgPool, role: Role) -> (String, Uuid, Uuid) {
    let config = test_config();

    let group_id = sqlx::query_scalar!(
        r#"
        INSERT INTO groups (name)
        VALUES ($1)
        RETURNING id
        "#,
        format!("Test Group {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let user_id = sqlx::query_scalar!(
        r#"
        INSERT INTO users (group_id, email, password_hash, role)
        VALUES ($1, $2, $3, $4::user_role)
        RETURNING id
        "#,
        group_id,
        format!("user-{}@example.com", Uuid::new_v4()),
        "dummy_hash",
        role as Role
    )
    .fetch_one(pool)
    .await
    .unwrap();

    let token = jwt::encode_jwt(
        user_id,
        group_id,
        role,
        &config.jwt_secret,
        config.jwt_expiration_seconds,
    )
    .unwrap();

    (format!("Bearer {token}"), user_id, group_id)
}

/// Helper to get an Admin Bearer token header string.
pub async fn setup_admin_token(pool: &PgPool) -> String {
    let (auth_header, _, _) = setup_user_token(pool, Role::Admin).await;
    auth_header
}
