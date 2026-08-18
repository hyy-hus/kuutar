use sqlx::PgPool;
use uuid::Uuid;

use super::models::{CreateGroup, Group, UpdateGroup};
use crate::errors::AppError;

pub async fn list_groups(pool: &PgPool) -> Result<Vec<Group>, AppError> {
    let groups = sqlx::query_as!(
        Group,
        r#"
        SELECT id, name, created_at, updated_at
        FROM groups
        WHERE deleted_at IS NULL
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(groups)
}

pub async fn get_group(pool: &PgPool, id: Uuid) -> Result<Group, AppError> {
    let group = sqlx::query_as!(
        Group,
        r#"
        SELECT id, name, created_at, updated_at
        FROM groups
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    Ok(group)
}

pub async fn create_group(pool: &PgPool, payload: &CreateGroup) -> Result<Group, AppError> {
    let group = sqlx::query_as!(
        Group,
        r#"
        INSERT INTO groups (name)
        VALUES ($1)
        RETURNING id, name, created_at, updated_at
        "#,
        payload.name
    )
    .fetch_one(pool)
    .await?;

    Ok(group)
}

pub async fn update_group(
    pool: &PgPool,
    id: Uuid,
    payload: &UpdateGroup,
) -> Result<Group, AppError> {
    let group = sqlx::query_as!(
        Group,
        r#"
        UPDATE groups
        SET name = $1
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING id, name, created_at, updated_at
        "#,
        payload.name,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    Ok(group)
}

pub async fn delete_group(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE groups
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;

    #[sqlx::test]
    async fn test_db_create_and_get_group(pool: PgPool) {
        let payload = CreateGroup {
            name: "Engineering".to_string(),
        };

        let created = create_group(&pool, &payload)
            .await
            .expect("Failed to create group");

        assert_eq!(created.name, "Engineering");

        let fetched = get_group(&pool, created.id)
            .await
            .expect("Failed to fetch group");

        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Engineering");
    }

    #[sqlx::test]
    async fn test_db_list_groups_ordering_and_filtering(pool: PgPool) {
        // Create groups out of alphabetical order
        let g1 = create_group(
            &pool,
            &CreateGroup {
                name: "Zeta".to_string(),
            },
        )
        .await
        .unwrap();
        let g2 = create_group(
            &pool,
            &CreateGroup {
                name: "Alpha".to_string(),
            },
        )
        .await
        .unwrap();
        let g3 = create_group(
            &pool,
            &CreateGroup {
                name: "Beta".to_string(),
            },
        )
        .await
        .unwrap();

        // Delete one group
        delete_group(&pool, g1.id).await.unwrap();

        let list = list_groups(&pool).await.expect("Failed to list groups");

        // Verify soft-deleted group is excluded and list is sorted ASC by name
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, g2.id); // Alpha
        assert_eq!(list[1].id, g3.id); // Beta
    }

    #[sqlx::test]
    async fn test_db_update_group(pool: PgPool) {
        let created = create_group(
            &pool,
            &CreateGroup {
                name: "Old Name".to_string(),
            },
        )
        .await
        .unwrap();

        let updated = update_group(
            &pool,
            created.id,
            &UpdateGroup {
                name: "New Name".to_string(),
            },
        )
        .await
        .expect("Failed to update group");

        assert_eq!(updated.name, "New Name");
    }

    #[sqlx::test]
    async fn test_db_delete_group_not_found(pool: PgPool) {
        let missing_id = Uuid::new_v4();

        // Try getting non-existent group
        let get_res = get_group(&pool, missing_id).await;
        assert!(matches!(get_res, Err(AppError::NotFound)));

        // Try deleting non-existent group
        let del_res = delete_group(&pool, missing_id).await;
        assert!(matches!(del_res, Err(AppError::NotFound)));
    }
}
