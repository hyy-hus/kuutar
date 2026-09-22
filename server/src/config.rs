use clap::Parser;
use std::net::SocketAddr;

#[derive(Parser, Debug, Clone)]
#[command(author, version, about = "Kuutar Web Server", long_about = None)]
pub struct Config {
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    #[arg(long, env = "BIND_ADDR", default_value = "127.0.0.1:3000")]
    pub bind_addr: SocketAddr,

    #[arg(long, env = "MAX_DB_CONNECTIONS", default_value_t = 5)]
    pub max_db_connections: u32,

    #[arg(long, env = "JWT_SECRET")]
    pub jwt_secret: String,

    #[arg(long, env = "JWT_EXPIRATION_SECONDS", default_value_t = 900)] // 15 mins default
    pub jwt_expiration_seconds: u64,

    #[arg(long, env = "SEED_ADMIN_EMAIL", default_value = "admin@localhost")]
    pub seed_admin_email: String,

    #[arg(long, env = "SEED_ADMIN_PASSWORD", default_value = "Admin")]
    pub seed_admin_password: String,

    // --- S3 / Scaleway Object Storage Configuration ---
    #[arg(long, env = "S3_BUCKET_NAME")]
    pub s3_bucket_name: String,

    #[arg(
        long,
        env = "S3_ENDPOINT",
        default_value = "https://s3.fr-par.scw.cloud"
    )]
    pub s3_endpoint: String,

    #[arg(long, env = "S3_REGION", default_value = "fr-par")]
    pub s3_region: String,

    #[arg(long, env = "AWS_ACCESS_KEY_ID")]
    pub aws_access_key_id: String,

    #[arg(long, env = "AWS_SECRET_ACCESS_KEY")]
    pub aws_secret_access_key: String,
}
