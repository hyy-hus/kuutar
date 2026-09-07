// src/main.rs
use anyhow::Context;
use clap::Parser;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use kuutar::{app, config::Config, seed};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let config = Config::parse();

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Connecting to the database...");

    let db_pool = PgPoolOptions::new()
        .max_connections(config.max_db_connections)
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
