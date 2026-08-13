// src/main.rs
use anyhow::Context;
use clap::Parser;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use kuutar::{app, config::Config};

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

    let app = app(db_pool);

    tracing::info!("Server running on http://{}", config.bind_addr);

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .context("Failed to bind to local socket address")?;

    axum::serve(listener, app)
        .await
        .context("An unrecoverable error occurred while running the Axum web server")?;

    Ok(())
}
