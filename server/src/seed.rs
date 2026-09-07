use crate::{config::Config, domains::users::models::Role};
use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn seed_admin_user(pool: &PgPool, config: &Config, password_hash: &str) -> Result<()> {
    // 1. Check if an admin user already exists
    let admin_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM users 
            WHERE role = $1::user_role AND deleted_at IS NULL
        )
        "#,
        Role::Admin as Role
    )
    .fetch_one(pool)
    .await
    .context("Failed to check for existing admin user")?;

    if admin_exists.unwrap_or(false) {
        tracing::info!("Admin account already exists. Skipping seed.");
        return Ok(());
    }

    tracing::info!(
        "No admin user found. Seeding initial admin: {}",
        config.seed_admin_email
    );

    // 2. Fetch the earliest created group or create 'Default' if no groups exist
    let group_id: Uuid =
        match sqlx::query!(r#"SELECT id FROM groups ORDER BY created_at ASC LIMIT 1"#)
            .fetch_optional(pool)
            .await?
        {
            Some(row) => row.id,
            None => {
                tracing::info!("No existing groups found. Creating 'Default' group...");
                sqlx::query_scalar!(
                    r#"
                INSERT INTO groups (name) 
                VALUES ('Default') 
                RETURNING id
                "#
                )
                .fetch_one(pool)
                .await
                .context("Failed to insert default group 'Default'")?
            }
        };

    // 3. Insert initial admin assigned to the selected group
    sqlx::query!(
        r#"
        INSERT INTO users (group_id, email, password_hash, role)
        VALUES ($1, LOWER($2), $3, $4::user_role)
        "#,
        group_id,
        config.seed_admin_email,
        password_hash,
        Role::Admin as Role
    )
    .execute(pool)
    .await
    .context("Failed to seed initial admin user")?;

    tracing::info!("Admin account seeded successfully.");

    Ok(())
}
