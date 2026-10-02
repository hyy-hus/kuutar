use std::collections::HashMap;

use serde_json::Value;
use sqlx::PgPool;

use super::{
    defaults::{VARIABLES, default_body, default_subject},
    models::{EmailTemplate, EmailTemplateKey, UpdateEmailTemplate},
};
use crate::{
    errors::AppError,
    utils::{
        lang::DEFAULT_LANGUAGE,
        rich_text::{LocalizedRichText, to_json},
    },
};

struct StoredTemplate {
    subject: Value,
    body: Value,
    updated_at: chrono::DateTime<chrono::Utc>,
}

async fn fetch_stored(
    pool: &PgPool,
    key: EmailTemplateKey,
) -> Result<Option<StoredTemplate>, AppError> {
    let row = sqlx::query!(
        r#"SELECT subject, body, updated_at FROM email_templates WHERE key = $1"#,
        key.as_str()
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| StoredTemplate {
        subject: row.subject,
        body: row.body,
        updated_at: row.updated_at,
    }))
}

/// Built-in defaults overlaid with whatever languages the admin has saved.
fn merge(key: EmailTemplateKey, stored: Option<StoredTemplate>) -> EmailTemplate {
    let mut subject = default_subject(key);
    let mut body = default_body(key);
    let customized = stored.is_some();
    let updated_at = stored.as_ref().map(|stored| stored.updated_at);

    if let Some(stored) = stored {
        if let Ok(overrides) = serde_json::from_value::<HashMap<String, String>>(stored.subject) {
            subject.extend(overrides);
        }
        if let Ok(overrides) = serde_json::from_value::<LocalizedRichText>(stored.body) {
            body.extend(overrides);
        }
    }

    EmailTemplate {
        key,
        subject,
        body,
        customized,
        updated_at,
        variables: VARIABLES.iter().map(|name| name.to_string()).collect(),
    }
}

pub async fn get(pool: &PgPool, key: EmailTemplateKey) -> Result<EmailTemplate, AppError> {
    Ok(merge(key, fetch_stored(pool, key).await?))
}

pub async fn list(pool: &PgPool) -> Result<Vec<EmailTemplate>, AppError> {
    let mut templates = Vec::with_capacity(EmailTemplateKey::ALL.len());
    for key in EmailTemplateKey::ALL {
        templates.push(get(pool, key).await?);
    }
    Ok(templates)
}

pub async fn save(
    pool: &PgPool,
    key: EmailTemplateKey,
    payload: UpdateEmailTemplate,
) -> Result<EmailTemplate, AppError> {
    let subject = serde_json::to_value(&payload.subject)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    sqlx::query!(
        r#"
        INSERT INTO email_templates (key, subject, body)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body
        "#,
        key.as_str(),
        subject,
        to_json(payload.body)
    )
    .execute(pool)
    .await?;

    get(pool, key).await
}

/// Drops the admin's version so the built-in default applies again.
pub async fn reset(pool: &PgPool, key: EmailTemplateKey) -> Result<EmailTemplate, AppError> {
    sqlx::query!(
        r#"DELETE FROM email_templates WHERE key = $1"#,
        key.as_str()
    )
    .execute(pool)
    .await?;

    get(pool, key).await
}

/// Subject and body for one language, falling back to the default language.
pub fn pick_language(template: &EmailTemplate, lang: &str) -> Option<(String, Value)> {
    let subject = template
        .subject
        .get(lang)
        .or_else(|| template.subject.get(DEFAULT_LANGUAGE))?;
    let body = template
        .body
        .get(lang)
        .or_else(|| template.body.get(DEFAULT_LANGUAGE))?;

    Some((subject.clone(), body.clone()))
}
