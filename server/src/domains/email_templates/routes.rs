use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use validator::Validate;

use super::{
    db,
    models::{
        EmailPreview, EmailTemplate, EmailTemplateKey, PreviewEmailTemplate, UpdateEmailTemplate,
    },
    notify::sample_variables,
    render,
};
use crate::{
    domains::{
        auth::{AuthState, extractor::RequireAdmin},
        users::db as users_db,
    },
    errors::AppError,
    utils::{
        lang::{DEFAULT_LANGUAGE, normalize_language},
        mail,
    },
};

#[utoipa::path(
    get,
    path = "/email-templates",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "All notification email templates", body = [EmailTemplate]),
        (status = 403, description = "Admin required")
    )
)]
pub async fn list_templates(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
) -> Result<Json<Vec<EmailTemplate>>, AppError> {
    Ok(Json(db::list(&state.pool).await?))
}

#[utoipa::path(
    get,
    path = "/email-templates/{key}",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    params(("key" = EmailTemplateKey, Path, description = "Template key")),
    responses((status = 200, description = "Email template", body = EmailTemplate))
)]
pub async fn get_template(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(key): Path<EmailTemplateKey>,
) -> Result<Json<EmailTemplate>, AppError> {
    Ok(Json(db::get(&state.pool, key).await?))
}

#[utoipa::path(
    put,
    path = "/email-templates/{key}",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    params(("key" = EmailTemplateKey, Path, description = "Template key")),
    request_body = UpdateEmailTemplate,
    responses(
        (status = 200, description = "Template saved", body = EmailTemplate),
        (status = 422, description = "Validation error")
    )
)]
pub async fn update_template(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(key): Path<EmailTemplateKey>,
    Json(payload): Json<UpdateEmailTemplate>,
) -> Result<Json<EmailTemplate>, AppError> {
    payload.validate()?;
    Ok(Json(db::save(&state.pool, key, payload).await?))
}

#[utoipa::path(
    delete,
    path = "/email-templates/{key}",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    params(("key" = EmailTemplateKey, Path, description = "Template key")),
    responses((status = 200, description = "Built-in default restored", body = EmailTemplate))
)]
pub async fn reset_template(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(key): Path<EmailTemplateKey>,
) -> Result<Json<EmailTemplate>, AppError> {
    Ok(Json(db::reset(&state.pool, key).await?))
}

/// Renders `subject`/`body` overrides from the request (unsaved edits) over the stored template.
async fn render_preview(
    state: &AuthState,
    key: EmailTemplateKey,
    payload: PreviewEmailTemplate,
) -> Result<(String, render::Rendered), AppError> {
    payload.validate()?;

    let lang =
        normalize_language(payload.language.as_deref().unwrap_or(DEFAULT_LANGUAGE)).to_string();
    let mut template = db::get(&state.pool, key).await?;
    if let Some(subject) = payload.subject {
        template.subject.extend(subject);
    }
    if let Some(body) = payload.body {
        template.body.extend(body);
    }

    let (subject, body) = db::pick_language(&template, &lang)
        .ok_or_else(|| AppError::BadRequest("Template has no content".to_string()))?;
    let vars = sample_variables(&state.config, &lang);

    Ok((
        render::substitute(&subject, &vars),
        render::render(&body, &vars),
    ))
}

#[utoipa::path(
    post,
    path = "/email-templates/{key}/preview",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    params(("key" = EmailTemplateKey, Path, description = "Template key")),
    request_body = PreviewEmailTemplate,
    responses((status = 200, description = "Rendered with sample data", body = EmailPreview))
)]
pub async fn preview_template(
    State(state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(key): Path<EmailTemplateKey>,
    Json(payload): Json<PreviewEmailTemplate>,
) -> Result<Json<EmailPreview>, AppError> {
    let (subject, rendered) = render_preview(&state, key, payload).await?;
    Ok(Json(EmailPreview {
        subject,
        html: rendered.html,
        text: rendered.text,
    }))
}

#[utoipa::path(
    post,
    path = "/email-templates/{key}/send-test",
    tag = "Email templates",
    security(("bearer_auth" = [])),
    params(("key" = EmailTemplateKey, Path, description = "Template key")),
    request_body = PreviewEmailTemplate,
    responses(
        (status = 204, description = "Test email sent to the calling admin"),
        (status = 400, description = "Email sending is not configured")
    )
)]
pub async fn send_test(
    State(state): State<AuthState>,
    RequireAdmin(admin): RequireAdmin,
    Path(key): Path<EmailTemplateKey>,
    Json(payload): Json<PreviewEmailTemplate>,
) -> Result<StatusCode, AppError> {
    if state.config.smtp_host.is_none() {
        return Err(AppError::BadRequest(
            "Sähköpostipalvelinta ei ole määritetty (SMTP_HOST).".to_string(),
        ));
    }

    let (subject, rendered) = render_preview(&state, key, payload).await?;
    let recipient = users_db::get_user(&state.pool, admin.id).await?;

    mail::send_email(
        &state.config,
        &recipient.email,
        None,
        &format!("[Testi] {subject}"),
        rendered.html,
        rendered.text,
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
