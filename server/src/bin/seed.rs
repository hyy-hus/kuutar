//! Fills a local database with synthetic mock data (see `kuutar::seed::mock`).
//!
//!     cargo run --bin seed -- --size prod --reset
//!
//! Every mock user has an `@example.test` address and the shared dev password.

use anyhow::{Context, Result, bail};
use clap::{Parser, ValueEnum};
use kuutar::seed::mock::{self, MockOptions, Size};
use sqlx::postgres::PgPoolOptions;

#[derive(Clone, Copy, ValueEnum)]
enum SizeArg {
    Small,
    Prod,
}

#[derive(Parser)]
#[command(about = "Seed the database with synthetic mock data")]
struct Args {
    #[arg(long, env = "DATABASE_URL")]
    database_url: String,
    /// RNG seed. The same seed and anchor date always produce the same data.
    #[arg(long, default_value_t = 42)]
    seed: u64,
    #[arg(long, value_enum, default_value = "prod")]
    size: SizeArg,
    /// "Today" for the dataset (YYYY-MM-DD). Defaults to the current date.
    #[arg(long)]
    anchor: Option<chrono::NaiveDate>,
    /// Shared password for all mock users.
    #[arg(long, default_value = "dev-password")]
    password: String,
    /// Remove previously seeded mock data first (only rows created by this seeder).
    #[arg(long)]
    reset: bool,
    /// Remove mock data and exit without seeding.
    #[arg(long)]
    reset_only: bool,
    /// Allow a database host other than localhost.
    #[arg(long)]
    allow_remote: bool,
}

fn host_of(url: &str) -> &str {
    let rest = url.split("://").nth(1).unwrap_or(url);
    let after_auth = rest.rsplit('@').next().unwrap_or(rest);
    after_auth.split(['/', ':', '?']).next().unwrap_or("")
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    let host = host_of(&args.database_url);
    if !args.allow_remote && !matches!(host, "localhost" | "127.0.0.1" | "::1" | "[::1]" | "db") {
        bail!(
            "Refusing to seed non-local database host '{host}'. Pass --allow-remote to override."
        );
    }

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&args.database_url)
        .await
        .context("connect to database")?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("run migrations")?;

    if args.reset || args.reset_only {
        mock::reset(&pool).await?;
        println!("Removed existing mock data.");
        if args.reset_only {
            return Ok(());
        }
    }

    let opts = MockOptions {
        seed: args.seed,
        size: match args.size {
            SizeArg::Small => Size::Small,
            SizeArg::Prod => Size::Prod,
        },
        anchor: args
            .anchor
            .unwrap_or_else(|| chrono::Local::now().date_naive()),
        password_hash: kuutar::domains::auth::password::hash_password(&args.password)?,
    };
    let s = mock::seed(&pool, &opts).await?;
    println!("{s:#?}");
    println!(
        "Log in as {} or {} with password '{}'.",
        mock::ADMIN_EMAIL,
        mock::USER_EMAIL,
        args.password
    );
    Ok(())
}
