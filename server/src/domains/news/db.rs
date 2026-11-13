//! Database queries for the `news` domain.
//!
//! Every read takes the viewer as `(is_admin, user_id, group_id)`; guests pass `(false, None,
//! None)`. Non-admins only see published items (`published_at <= NOW()`) whose visibility admits
//! them; hidden items behave as if they did not exist.
//!
//! An item is unread for a signed-in user when it is published, was published after the user's
//! account was created, and has no row in `news_reads`.

use sqlx::PgPool;
use uuid::Uuid;

use super::models::{News, NewsInput, NewsSummary, NewsVisibility};
use crate::{errors::AppError, utils::rich_text};

/// Requesting user, as far as visibility and read state are concerned.
#[derive(Debug, Clone, Copy, Default)]
pub struct Viewer {
    pub is_admin: bool,
    pub user_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
}

/// Visible items, newest first. Admins also get drafts and scheduled items (those without a
/// publish time first).
pub async fn list(pool: &PgPool, viewer: Viewer) -> Result<Vec<NewsSummary>, AppError> {
    let items = sqlx::query_as!(
        NewsSummary,
        r#"
        SELECT n.id, n.title, n.blurb, n.visibility AS "visibility: NewsVisibility",
               n.published_at, n.highlighted, n.highlight_until,
               CASE WHEN $2::uuid IS NULL THEN NULL ELSE NOT (
                   n.published_at IS NOT NULL AND n.published_at <= NOW()
                   AND n.published_at >= COALESCE((SELECT u.created_at FROM users u WHERE u.id = $2), '-infinity')
                   AND NOT EXISTS (SELECT 1 FROM news_reads r WHERE r.news_id = n.id AND r.user_id = $2)
               ) END AS is_read,
               n.created_at, n.updated_at
        FROM news n
        WHERE n.deleted_at IS NULL
          AND ($1 OR (n.published_at IS NOT NULL AND n.published_at <= NOW() AND (
              n.visibility = 'public'
              OR ($2::uuid IS NOT NULL AND (
                  n.visibility = 'users'
                  OR (n.visibility = 'groups' AND EXISTS (
                      SELECT 1 FROM news_visibility_groups g WHERE g.news_id = n.id AND g.group_id = $3
                  ))
              ))
          )))
        ORDER BY n.published_at DESC NULLS FIRST, n.created_at DESC
        "#,
        viewer.is_admin,
        viewer.user_id,
        viewer.group_id
    )
    .fetch_all(pool)
    .await?;

    Ok(items)
}

/// Highlighted items the viewer can see whose highlight has not ended, newest first. Signed-in
/// users only get the ones they have not read yet. Drafts and scheduled items are left out for
/// admins too, since this is what the home page shows.
pub async fn list_highlights(
    pool: &PgPool,
    viewer: Viewer,
    limit: i64,
) -> Result<Vec<NewsSummary>, AppError> {
    let items = sqlx::query_as!(
        NewsSummary,
        r#"
        SELECT n.id, n.title, n.blurb, n.visibility AS "visibility: NewsVisibility",
               n.published_at, n.highlighted, n.highlight_until,
               CASE WHEN $2::uuid IS NULL THEN NULL ELSE FALSE END AS is_read,
               n.created_at, n.updated_at
        FROM news n
        WHERE n.deleted_at IS NULL
          AND n.highlighted
          AND (n.highlight_until IS NULL OR n.highlight_until > NOW())
          AND n.published_at IS NOT NULL AND n.published_at <= NOW()
          AND ($1 OR n.visibility = 'public'
              OR ($2::uuid IS NOT NULL AND (
                  n.visibility = 'users'
                  OR (n.visibility = 'groups' AND EXISTS (
                      SELECT 1 FROM news_visibility_groups g WHERE g.news_id = n.id AND g.group_id = $3
                  ))
              )))
          AND ($2::uuid IS NULL OR NOT EXISTS (
              SELECT 1 FROM news_reads r WHERE r.news_id = n.id AND r.user_id = $2
          ))
        ORDER BY n.published_at DESC
        LIMIT $4
        "#,
        viewer.is_admin,
        viewer.user_id,
        viewer.group_id,
        limit
    )
    .fetch_all(pool)
    .await?;

    Ok(items)
}

/// A visible item by id; NotFound when it does not exist or the viewer cannot see it.
pub async fn find_by_id(pool: &PgPool, id: Uuid, viewer: Viewer) -> Result<News, AppError> {
    sqlx::query_as!(
        News,
        r#"
        SELECT n.id, n.title, n.blurb, n.body, n.visibility AS "visibility: NewsVisibility",
               CASE WHEN $1 THEN COALESCE(ARRAY(
                   SELECT g.group_id FROM news_visibility_groups g WHERE g.news_id = n.id ORDER BY g.group_id
               ), '{}') ELSE '{}' END AS "visible_group_ids!",
               n.published_at, n.highlighted, n.highlight_until,
               CASE WHEN $2::uuid IS NULL THEN NULL ELSE NOT (
                   n.published_at IS NOT NULL AND n.published_at <= NOW()
                   AND n.published_at >= COALESCE((SELECT u.created_at FROM users u WHERE u.id = $2), '-infinity')
                   AND NOT EXISTS (SELECT 1 FROM news_reads r WHERE r.news_id = n.id AND r.user_id = $2)
               ) END AS is_read,
               n.created_at, n.updated_at
        FROM news n
        WHERE n.id = $4
          AND n.deleted_at IS NULL
          AND ($1 OR (n.published_at IS NOT NULL AND n.published_at <= NOW() AND (
              n.visibility = 'public'
              OR ($2::uuid IS NOT NULL AND (
                  n.visibility = 'users'
                  OR (n.visibility = 'groups' AND EXISTS (
                      SELECT 1 FROM news_visibility_groups g WHERE g.news_id = n.id AND g.group_id = $3
                  ))
              ))
          )))
        "#,
        viewer.is_admin,
        viewer.user_id,
        viewer.group_id,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Number of visible, unread items for a signed-in user.
pub async fn unread_count(pool: &PgPool, viewer: Viewer, user_id: Uuid) -> Result<i64, AppError> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM news n
        WHERE n.deleted_at IS NULL
          AND n.published_at IS NOT NULL AND n.published_at <= NOW()
          AND n.published_at >= COALESCE((SELECT u.created_at FROM users u WHERE u.id = $2), '-infinity')
          AND ($1 OR n.visibility IN ('public', 'users')
              OR (n.visibility = 'groups' AND EXISTS (
                  SELECT 1 FROM news_visibility_groups g WHERE g.news_id = n.id AND g.group_id = $3
              )))
          AND NOT EXISTS (SELECT 1 FROM news_reads r WHERE r.news_id = n.id AND r.user_id = $2)
        "#,
        viewer.is_admin,
        user_id,
        viewer.group_id
    )
    .fetch_one(pool)
    .await?;

    Ok(count)
}

/// Marks one item read. Callers check visibility first.
pub async fn mark_read(pool: &PgPool, user_id: Uuid, news_id: Uuid) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO news_reads (user_id, news_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        user_id,
        news_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Marks every published item the user can see as read.
pub async fn mark_all_read(pool: &PgPool, viewer: Viewer, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query!(
        r#"
        INSERT INTO news_reads (user_id, news_id)
        SELECT $2, n.id
        FROM news n
        WHERE n.deleted_at IS NULL
          AND n.published_at IS NOT NULL AND n.published_at <= NOW()
          AND ($1 OR n.visibility IN ('public', 'users')
              OR (n.visibility = 'groups' AND EXISTS (
                  SELECT 1 FROM news_visibility_groups g WHERE g.news_id = n.id AND g.group_id = $3
              )))
        ON CONFLICT DO NOTHING
        "#,
        viewer.is_admin,
        user_id,
        viewer.group_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn replace_visibility_groups(
    tx: &mut sqlx::PgConnection,
    news_id: Uuid,
    group_ids: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM news_visibility_groups WHERE news_id = $1",
        news_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO news_visibility_groups (news_id, group_id)
        SELECT $1, UNNEST($2::uuid[])
        ON CONFLICT DO NOTHING
        "#,
        news_id,
        group_ids
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

/// Inserts a new item; `dto` must be normalized and validated.
pub async fn create(pool: &PgPool, dto: NewsInput, created_by: Uuid) -> Result<Uuid, AppError> {
    let mut tx = pool.begin().await?;

    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO news (title, blurb, body, visibility, published_at, highlighted, highlight_until, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
        serde_json::to_value(&dto.title).map_err(|e| AppError::InternalServerError(e.to_string()))?,
        serde_json::to_value(&dto.blurb).map_err(|e| AppError::InternalServerError(e.to_string()))?,
        dto.body.map(rich_text::to_json),
        dto.visibility as NewsVisibility,
        dto.published_at,
        dto.highlighted,
        dto.highlight_until,
        created_by
    )
    .fetch_one(&mut *tx)
    .await?;

    replace_visibility_groups(&mut tx, id, &dto.visible_group_ids).await?;
    tx.commit().await?;

    Ok(id)
}

/// Replaces every editable field of an active item; `dto` must be normalized and validated.
pub async fn update(pool: &PgPool, id: Uuid, dto: NewsInput) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE news
        SET title = $1, blurb = $2, body = $3, visibility = $4,
            published_at = $5, highlighted = $6, highlight_until = $7
        WHERE id = $8 AND deleted_at IS NULL
        "#,
        serde_json::to_value(&dto.title)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?,
        serde_json::to_value(&dto.blurb)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?,
        dto.body.map(rich_text::to_json),
        dto.visibility as NewsVisibility,
        dto.published_at,
        dto.highlighted,
        dto.highlight_until,
        id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    replace_visibility_groups(&mut tx, id, &dto.visible_group_ids).await?;
    tx.commit().await?;

    Ok(())
}

/// Soft-deletes an item by setting its `deleted_at` timestamp.
pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query!(
        "UPDATE news SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
        id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}
