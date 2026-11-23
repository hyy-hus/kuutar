// src/main.rs
use anyhow::Context;
use clap::Parser;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use kuutar::{app, config::Config, seed};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let config = Config::parse();

    // Without a filter every crate logs at TRACE level, which floods the logs and costs CPU.
    // RUST_LOG overrides the default, e.g. `RUST_LOG=info,kuutar=debug`.
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Connecting to the database...");

    let db_pool = PgPoolOptions::new()
        .max_connections(config.max_db_connections)
        .min_connections(0)
        .idle_timeout(std::time::Duration::from_secs(config.db_idle_timeout_seconds))
        .connect(&config.database_url)
        .await
        .context("Failed to connect to database")?;

    tracing::info!("Database connection established successfully.");

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .context("Failed to run database migrations")?;

    let hashed_password =
        kuutar::domains::auth::password::hash_password(&config.seed_admin_password)?; // Adjust path to your password hasher
    seed::seed_admin_user(&db_pool, &config, &hashed_password).await?;

    kuutar::domains::auth::purge::spawn(db_pool.clone());
    kuutar::domains::outlook_sync::poller::spawn(db_pool.clone(), config.clone());

    let app = app(db_pool, config.clone());

    tracing::info!("Server running on http://{}", config.bind_addr);

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .context("Failed to bind to local socket address")?;

    axum::serve(listener, app)
        .await
        .context("An unrecoverable error occurred while running the Axum web server")?;

    Ok(())
}
