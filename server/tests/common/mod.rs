use kuutar::{
    config::{Config, SmtpTls},
    domains::auth::jwt,
    domains::users::models::Role,
};
use sqlx::PgPool;
use uuid::Uuid;

pub fn test_config() -> Config {
    Config {
        database_url: "postgres://postgres:postgres@localhost:5432/test_db".to_string(),
        bind_addr: "127.0.0.1:0".parse().expect("valid socket address"),
        max_db_connections: 5,
        jwt_secret: "test_secret_key_12345_super_secret".to_string(),
        jwt_expiration_seconds: 900,
        seed_admin_email: "admin@localhost".to_string(),
        seed_admin_password: "Admin".to_string(),
        smtp_host: None,
        smtp_port: 587,
        smtp_tls: SmtpTls::Starttls,
        smtp_username: None,
        smtp_password: None,
        app_base_url: "http://localhost:5173".to_string(),
        smtp_from_email: "Kuutar <noreply@kuutar.fi>".to_string(),
        graph_tenant_id: None,
        graph_client_id: None,
        graph_client_secret: None,
        graph_intake_mailbox: None,
        graph_poll_seconds: 60,
        graph_base_url: "https://graph.microsoft.com/v1.0".to_string(),
        graph_login_url: "https://login.microsoftonline.com".to_string(),
        outlook_fallback_user_email: None,
        s3_bucket_name: "test-bucket".to_string(),
        s3_endpoint: "https://s3.fr-par.scw.cloud".to_string(),
        s3_region: "fr-par".to_string(),
        aws_access_key_id: "test_key".to_string(),
        aws_secret_access_key: "test_secret".to_string(),
    }
}

/// Creates a test group, returning its id.
pub async fn create_group(pool: &PgPool) -> Uuid {
    sqlx::query_scalar!(
        "INSERT INTO groups (name) VALUES ($1) RETURNING id",
        format!("Test Group {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Creates a user with the given role in an existing group, returning a Bearer token and user id.
pub async fn setup_user_in_group(pool: &PgPool, role: Role, group_id: Uuid) -> (String, Uuid) {
    let config = test_config();

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

    (format!("Bearer {token}"), user_id)
}

/// Creates a test group and user with the given role, returning a valid Bearer token header string.
pub async fn setup_user_token(pool: &PgPool, role: Role) -> (String, Uuid, Uuid) {
    let group_id = create_group(pool).await;
    let (token, user_id) = setup_user_in_group(pool, role, group_id).await;
    (token, user_id, group_id)
}

/// Helper to get an Admin Bearer token header string.
pub async fn setup_admin_token(pool: &PgPool) -> String {
    let (auth_header, _, _) = setup_user_token(pool, Role::Admin).await;
    auth_header
}
