use sqlx::PgPool;
use uuid::Uuid;

use super::models::{CreateUser, Role, UpdateUser, User};
use crate::errors::AppError;

pub async fn list_users(pool: &PgPool) -> Result<Vec<User>, AppError> {
    let users = sqlx::query_as!(
        User,
        r#"
        SELECT id, group_id, name, email, default_contact_person, default_contact_email, default_contact_phone, language, role AS "role: Role", created_at, updated_at
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY name ASC, email ASC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(users)
}

pub async fn get_user(pool: &PgPool, id: Uuid) -> Result<User, AppError> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, group_id, name, email, default_contact_person, default_contact_email, default_contact_phone, language, role AS "role: Role", created_at, updated_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(user)
}

pub async fn create_user(
    pool: &PgPool,
    payload: &CreateUser,
    password_hash: &str,
) -> Result<User, AppError> {
    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (group_id, name, email, password_hash, language)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'fi'))
        RETURNING id, group_id, name, email, default_contact_person, default_contact_email, default_contact_phone, language, role AS "role: Role", created_at, updated_at
        "#,
        payload.group_id,
        payload.name,
        payload.email.to_lowercase(),
        password_hash,
        payload.language
    )
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn update_user(
    pool: &PgPool,
    id: Uuid,
    payload: &UpdateUser,
    new_password_hash: Option<&str>,
) -> Result<User, AppError> {
    let user = sqlx::query_as!(
        User,
        r#"
        UPDATE users
        SET 
            name = COALESCE($1, name),
            email = COALESCE($2, email),
            password_hash = COALESCE($3, password_hash),
            group_id = COALESCE($4, group_id),
            default_contact_person = CASE WHEN $5::text IS NULL THEN default_contact_person ELSE NULLIF($5, '') END,
            default_contact_email = CASE WHEN $6::text IS NULL THEN default_contact_email ELSE NULLIF($6, '') END,
            default_contact_phone = CASE WHEN $7::text IS NULL THEN default_contact_phone ELSE NULLIF($7, '') END,
            language = COALESCE($8, language),
            updated_at = NOW()
        WHERE id = $9 AND deleted_at IS NULL
        RETURNING id, group_id, name, email, default_contact_person, default_contact_email, default_contact_phone, language, role AS "role: Role", created_at, updated_at
        "#,
        payload.name,
        payload.email.as_ref().map(|e| e.to_lowercase()),
        new_password_hash,
        payload.group_id,
        payload.default_contact_person,
        payload.default_contact_email.as_ref().map(|e| e.to_lowercase()),
        payload.default_contact_phone,
        payload.language,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(user)
}

pub async fn delete_user(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE users
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Revoke all active refresh tokens for the soft-deleted user
    sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'user_deleted'
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
        id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::groups::db::create_group;
    use crate::domains::groups::models::CreateGroup;
    use sqlx::PgPool;

    async fn setup_test_group(pool: &PgPool) -> Uuid {
        let group = create_group(
            pool,
            &CreateGroup {
                name: format!("Test Group {}", Uuid::new_v4()),
                description: None,
            },
        )
        .await
        .unwrap();
        group.id
    }

    #[sqlx::test]
    async fn test_db_create_and_get_user(pool: PgPool) {
        let group_id = setup_test_group(&pool).await;

        let payload = CreateUser {
            group_id,
            name: "Test User".to_string(),
            email: "testuser@example.com".to_string(),
            password: "password123".to_string(),
            language: None,
        };

        let created = create_user(&pool, &payload, "fake_hash")
            .await
            .expect("Failed to create user");

        assert_eq!(created.name, "Test User");
        assert_eq!(created.email, "testuser@example.com");
        assert_eq!(created.group_id, group_id);
        assert_eq!(created.role, Role::User);

        let fetched = get_user(&pool, created.id)
            .await
            .expect("Failed to fetch user");

        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Test User");
        assert_eq!(fetched.email, "testuser@example.com");
        assert_eq!(fetched.role, Role::User);
    }

    #[sqlx::test]
    async fn test_db_list_users_ordering_and_filtering(pool: PgPool) {
        let group_id = setup_test_group(&pool).await;

        let u1 = create_user(
            &pool,
            &CreateUser {
                group_id,
                name: "Zeta User".to_string(),
                email: "zeta@example.com".to_string(),
                password: "password123".to_string(),
                language: None,
            },
            "hash1",
        )
        .await
        .unwrap();

        let u2 = create_user(
            &pool,
            &CreateUser {
                group_id,
                name: "Alpha User".to_string(),
                email: "alpha@example.com".to_string(),
                password: "password123".to_string(),
                language: None,
            },
            "hash2",
        )
        .await
        .unwrap();

        // Soft-delete one user
        delete_user(&pool, u1.id).await.unwrap();

        let list = list_users(&pool).await.expect("Failed to list users");

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, u2.id);
        assert_eq!(list[0].name, "Alpha User");
        assert_eq!(list[0].email, "alpha@example.com");
        assert_eq!(list[0].role, Role::User);
    }

    #[sqlx::test]
    async fn test_db_update_user(pool: PgPool) {
        let group_id = setup_test_group(&pool).await;

        let created = create_user(
            &pool,
            &CreateUser {
                group_id,
                name: "Old Name".to_string(),
                email: "old@example.com".to_string(),
                password: "password123".to_string(),
                language: None,
            },
            "old_hash",
        )
        .await
        .unwrap();

        let updated = update_user(
            &pool,
            created.id,
            &UpdateUser {
                name: Some("New Name".to_string()),
                email: Some("new@example.com".to_string()),
                password: None,
                group_id: None,
                default_contact_person: Some("Contact Person".to_string()),
                default_contact_email: Some("Contact@Example.com".to_string()),
                default_contact_phone: Some("+358401234567".to_string()),
                language: None,
            },
            None,
        )
        .await
        .expect("Failed to update user");

        assert_eq!(
            updated.default_contact_person.as_deref(),
            Some("Contact Person")
        );
        assert_eq!(
            updated.default_contact_email.as_deref(),
            Some("contact@example.com")
        );
        assert_eq!(
            updated.default_contact_phone.as_deref(),
            Some("+358401234567")
        );

        // Omitted fields stay unchanged, empty string clears
        let cleared = update_user(
            &pool,
            created.id,
            &UpdateUser {
                name: None,
                email: None,
                password: None,
                group_id: None,
                default_contact_person: Some(String::new()),
                default_contact_email: None,
                default_contact_phone: None,
                language: None,
            },
            None,
        )
        .await
        .expect("Failed to update user");
        assert_eq!(cleared.default_contact_person, None);
        assert_eq!(
            cleared.default_contact_email.as_deref(),
            Some("contact@example.com")
        );

        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.email, "new@example.com");
        assert_eq!(updated.role, Role::User);
    }

    #[sqlx::test]
    async fn test_db_delete_user_not_found(pool: PgPool) {
        let missing_id = Uuid::new_v4();

        let get_res = get_user(&pool, missing_id).await;
        assert!(matches!(get_res, Err(AppError::NotFound)));

        let del_res = delete_user(&pool, missing_id).await;
        assert!(matches!(del_res, Err(AppError::NotFound)));
    }
}
