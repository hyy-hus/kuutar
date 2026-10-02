use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::{Validate, ValidationError};

use crate::utils::rich_text::{LocalizedRichText, validate_localized_rich_text};

/// The events that trigger a notification email.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EmailTemplateKey {
    ReservationCreated,
    ReservationConfirmed,
    ReservationCancelled,
}

impl EmailTemplateKey {
    pub const ALL: [EmailTemplateKey; 3] = [
        EmailTemplateKey::ReservationCreated,
        EmailTemplateKey::ReservationConfirmed,
        EmailTemplateKey::ReservationCancelled,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            EmailTemplateKey::ReservationCreated => "reservation_created",
            EmailTemplateKey::ReservationConfirmed => "reservation_confirmed",
            EmailTemplateKey::ReservationCancelled => "reservation_cancelled",
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EmailTemplate {
    pub key: EmailTemplateKey,
    /// Subject lines per language code; `{{variables}}` are allowed.
    pub subject: HashMap<String, String>,
    /// Tiptap documents per language code; `{{variables}}` are allowed in text and links.
    #[schema(value_type = HashMap<String, Object>)]
    pub body: LocalizedRichText,
    /// False while the built-in default is in use.
    pub customized: bool,
    pub updated_at: Option<DateTime<Utc>>,
    /// Placeholders that can be used in the subject and body.
    pub variables: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateEmailTemplate {
    #[validate(custom(function = "validate_subjects"))]
    pub subject: HashMap<String, String>,

    #[validate(custom(function = "validate_localized_rich_text"))]
    #[schema(value_type = HashMap<String, Object>)]
    pub body: LocalizedRichText,
}

fn validate_subjects(subjects: &HashMap<String, String>) -> Result<(), ValidationError> {
    for (lang, subject) in subjects {
        crate::utils::lang::validate_language(lang)?;
        if subject.trim().is_empty() || subject.len() > 255 || subject.contains(['\n', '\r']) {
            return Err(ValidationError::new("invalid_subject"));
        }
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct PreviewEmailTemplate {
    /// Language to preview; defaults to Finnish.
    pub language: Option<String>,
    #[validate(custom(function = "validate_subjects"))]
    pub subject: Option<HashMap<String, String>>,
    #[validate(custom(function = "validate_localized_rich_text"))]
    #[schema(value_type = Option<HashMap<String, Object>>)]
    pub body: Option<LocalizedRichText>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmailPreview {
    pub subject: String,
    pub html: String,
    pub text: String,
}
