use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{Validate, ValidationError};

use crate::utils::{
    lang::validate_language,
    rich_text::{LocalizedRichText, validate_localized_rich_text},
};

/// Plain text per language code, e.g. `{"fi": "Otsikko", "en": "Title"}`.
pub type LocalizedText = HashMap<String, String>;

pub const MAX_TITLE_CHARS: usize = 200;
pub const MAX_BLURB_CHARS: usize = 500;

/// Who can read a published news item. Admins always see everything.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "news_visibility", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum NewsVisibility {
    /// Everyone, guests included
    Public,
    /// Signed-in users
    Users,
    /// Members of `visible_group_ids`
    Groups,
}

/// A news item in a list: everything but the body.
#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct NewsSummary {
    pub id: Uuid,
    #[schema(value_type = HashMap<String, String>)]
    pub title: serde_json::Value,
    #[schema(value_type = HashMap<String, String>)]
    pub blurb: serde_json::Value,
    pub visibility: NewsVisibility,
    /// Null for drafts; a future time means scheduled. Only admins see either.
    pub published_at: Option<DateTime<Utc>>,
    pub highlighted: bool,
    pub highlight_until: Option<DateTime<Utc>>,
    /// Whether the signed-in user has read the item; null for guests. Items published before the
    /// account was created count as read.
    pub is_read: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A full news item.
#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct News {
    pub id: Uuid,
    #[schema(value_type = HashMap<String, String>)]
    pub title: serde_json::Value,
    #[schema(value_type = HashMap<String, String>)]
    pub blurb: serde_json::Value,
    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    pub body: Option<serde_json::Value>,
    pub visibility: NewsVisibility,
    /// Groups that see a `groups` item; only returned to admins (empty otherwise)
    pub visible_group_ids: Vec<Uuid>,
    pub published_at: Option<DateTime<Utc>>,
    pub highlighted: bool,
    pub highlight_until: Option<DateTime<Utc>>,
    pub is_read: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Body for creating or replacing a news item. Updates send the whole item.
#[derive(Debug, Deserialize, Validate, ToSchema)]
#[validate(schema(function = "validate_news_input"))]
pub struct NewsInput {
    /// At least one language is required
    #[validate(custom(function = "validate_title"))]
    pub title: LocalizedText,

    #[serde(default)]
    #[validate(custom(function = "validate_blurb"))]
    pub blurb: LocalizedText,

    /// Localized Tiptap documents, e.g. {"fi": {"type": "doc", ...}}
    #[schema(value_type = Option<HashMap<String, serde_json::Value>>)]
    #[validate(custom(function = "validate_localized_rich_text"))]
    pub body: Option<LocalizedRichText>,

    pub visibility: NewsVisibility,

    /// Required (non-empty) when `visibility` is `groups`; ignored otherwise
    #[serde(default)]
    pub visible_group_ids: Vec<Uuid>,

    /// Null keeps the item as a draft
    pub published_at: Option<DateTime<Utc>>,

    #[serde(default)]
    pub highlighted: bool,

    pub highlight_until: Option<DateTime<Utc>>,
}

impl NewsInput {
    /// Trims every text and drops languages left empty, so validation sees what gets stored.
    pub fn normalize(&mut self) {
        normalize_text(&mut self.title);
        normalize_text(&mut self.blurb);
        if self.visibility != NewsVisibility::Groups {
            self.visible_group_ids.clear();
        }
        if !self.highlighted {
            self.highlight_until = None;
        }
    }
}

fn normalize_text(text: &mut LocalizedText) {
    text.retain(|_, value| {
        let trimmed = value.trim();
        if trimmed.len() != value.len() {
            *value = trimmed.to_string();
        }
        !value.is_empty()
    });
}

fn validate_languages(text: &LocalizedText, max_chars: usize) -> Result<(), ValidationError> {
    for (lang, value) in text {
        validate_language(lang)?;
        if value.chars().count() > max_chars {
            return Err(ValidationError::new("too_long"));
        }
    }
    Ok(())
}

fn validate_title(title: &LocalizedText) -> Result<(), ValidationError> {
    if title.values().all(|value| value.trim().is_empty()) {
        return Err(ValidationError::new("title_required"));
    }
    if title.values().any(|value| value.contains(['\n', '\r'])) {
        return Err(ValidationError::new("title_single_line"));
    }
    validate_languages(title, MAX_TITLE_CHARS)
}

fn validate_blurb(blurb: &LocalizedText) -> Result<(), ValidationError> {
    validate_languages(blurb, MAX_BLURB_CHARS)
}

fn validate_news_input(input: &NewsInput) -> Result<(), ValidationError> {
    if input.visibility == NewsVisibility::Groups && input.visible_group_ids.is_empty() {
        return Err(ValidationError::new("visibility_groups_required"));
    }
    Ok(())
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UnreadNewsCount {
    pub count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(json: serde_json::Value) -> NewsInput {
        let mut input: NewsInput = serde_json::from_value(json).unwrap();
        input.normalize();
        input
    }

    #[test]
    fn test_valid_minimal_input() {
        let dto = input(serde_json::json!({"title": {"fi": "Otsikko"}, "visibility": "public"}));
        assert!(dto.validate().is_ok());
        assert!(dto.blurb.is_empty());
    }

    #[test]
    fn test_blank_titles_are_dropped_and_rejected() {
        let dto =
            input(serde_json::json!({"title": {"fi": "  ", "en": ""}, "visibility": "users"}));
        assert!(dto.title.is_empty());
        assert!(dto.validate().is_err());
    }

    #[test]
    fn test_texts_are_trimmed() {
        let dto = input(serde_json::json!({
            "title": {"fi": "  Otsikko "},
            "blurb": {"fi": " Lyhyesti ", "sv": " "},
            "visibility": "users"
        }));
        assert_eq!(dto.title["fi"], "Otsikko");
        assert_eq!(dto.blurb.len(), 1);
        assert_eq!(dto.blurb["fi"], "Lyhyesti");
    }

    #[test]
    fn test_rejects_unsupported_language_and_long_text() {
        let dto = input(serde_json::json!({"title": {"de": "Titel"}, "visibility": "users"}));
        assert!(dto.validate().is_err());

        let long = "a".repeat(MAX_BLURB_CHARS + 1);
        let dto = input(serde_json::json!({
            "title": {"fi": "Otsikko"}, "blurb": {"fi": long}, "visibility": "users"
        }));
        assert!(dto.validate().is_err());
    }

    #[test]
    fn test_groups_visibility_needs_groups() {
        let dto = input(serde_json::json!({"title": {"fi": "Otsikko"}, "visibility": "groups"}));
        assert!(dto.validate().is_err());

        let dto = input(serde_json::json!({
            "title": {"fi": "Otsikko"},
            "visibility": "groups",
            "visible_group_ids": [Uuid::new_v4()]
        }));
        assert!(dto.validate().is_ok());
    }

    #[test]
    fn test_normalize_clears_unused_fields() {
        let dto = input(serde_json::json!({
            "title": {"fi": "Otsikko"},
            "visibility": "public",
            "visible_group_ids": [Uuid::new_v4()],
            "highlighted": false,
            "highlight_until": "2026-12-01T00:00:00Z"
        }));
        assert!(dto.visible_group_ids.is_empty());
        assert!(dto.highlight_until.is_none());
    }
}
