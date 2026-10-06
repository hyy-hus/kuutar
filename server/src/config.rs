use clap::{Parser, ValueEnum};
use std::net::SocketAddr;

#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpTls {
    /// Plain connection upgraded with STARTTLS (required).
    Starttls,
    /// Implicit TLS from the first byte.
    Tls,
    /// No encryption; only for local development servers.
    None,
}

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

    // --- SMTP Email / OTP Configuration ---
    /// SMTP server hostname. Without it, sign-in by email code is unavailable.
    #[arg(long, env = "SMTP_HOST")]
    pub smtp_host: Option<String>,

    #[arg(long, env = "SMTP_PORT", default_value_t = 587)]
    pub smtp_port: u16,

    /// Connection security: `starttls` (typically port 587), `tls` (implicit TLS, port 465) or `none`.
    #[arg(long, env = "SMTP_TLS", value_enum, default_value_t = SmtpTls::Starttls)]
    pub smtp_tls: SmtpTls,

    #[arg(long, env = "SMTP_USERNAME")]
    pub smtp_username: Option<String>,

    #[arg(long, env = "SMTP_PASSWORD")]
    pub smtp_password: Option<String>,

    #[arg(
        long,
        env = "SMTP_FROM_EMAIL",
        default_value = "Kuutar <noreply@kuutar.fi>"
    )]
    pub smtp_from_email: String,

    /// Public URL of the web app, used for links in emails.
    #[arg(long, env = "APP_BASE_URL", default_value = "http://localhost:5173")]
    pub app_base_url: String,

    // --- Outlook / Microsoft Graph (optional; the integration is off without GRAPH_TENANT_ID) ---
    #[arg(long, env = "GRAPH_TENANT_ID")]
    pub graph_tenant_id: Option<String>,

    #[arg(long, env = "GRAPH_CLIENT_ID")]
    pub graph_client_id: Option<String>,

    #[arg(long, env = "GRAPH_CLIENT_SECRET")]
    pub graph_client_secret: Option<String>,

    /// Mailbox that receives the forwarded Outlook invites
    #[arg(long, env = "GRAPH_INTAKE_MAILBOX")]
    pub graph_intake_mailbox: Option<String>,

    #[arg(long, env = "GRAPH_POLL_SECONDS", default_value_t = 60)]
    pub graph_poll_seconds: u64,

    #[arg(
        long,
        env = "GRAPH_BASE_URL",
        default_value = "https://graph.microsoft.com/v1.0"
    )]
    pub graph_base_url: String,

    #[arg(
        long,
        env = "GRAPH_LOGIN_URL",
        default_value = "https://login.microsoftonline.com"
    )]
    pub graph_login_url: String,

    /// Owner of imported events whose organizer is not a Kuutar user (defaults to the seed admin)
    #[arg(long, env = "OUTLOOK_FALLBACK_USER_EMAIL")]
    pub outlook_fallback_user_email: Option<String>,

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

impl Config {
    /// True when every Graph setting needed to read the intake mailbox is present.
    pub fn outlook_enabled(&self) -> bool {
        self.graph_tenant_id.is_some()
            && self.graph_client_id.is_some()
            && self.graph_client_secret.is_some()
            && self.graph_intake_mailbox.is_some()
    }
}
