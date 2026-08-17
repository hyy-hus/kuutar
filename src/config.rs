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
}
