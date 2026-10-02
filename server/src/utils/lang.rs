//! Languages the app can send emails in.

use validator::ValidationError;

pub const SUPPORTED_LANGUAGES: [&str; 3] = ["fi", "sv", "en"];
pub const DEFAULT_LANGUAGE: &str = "fi";

pub fn validate_language(code: &str) -> Result<(), ValidationError> {
    if SUPPORTED_LANGUAGES.contains(&code) {
        Ok(())
    } else {
        Err(ValidationError::new("unsupported_language"))
    }
}

/// Returns `code` if supported, otherwise the default language.
pub fn normalize_language(code: &str) -> &str {
    SUPPORTED_LANGUAGES
        .iter()
        .find(|supported| **supported == code)
        .copied()
        .unwrap_or(DEFAULT_LANGUAGE)
}
