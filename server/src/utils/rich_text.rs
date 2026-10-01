//! Localized rich text stored as Tiptap (ProseMirror) JSON documents.

use std::collections::HashMap;

use serde_json::Value;
use validator::ValidationError;

/// Map of language codes to Tiptap documents, e.g. `{"fi": {"type": "doc", ...}}`.
pub type LocalizedRichText = HashMap<String, Value>;

/// Converts localized rich text into a JSON value for a JSONB column.
pub fn to_json(text: LocalizedRichText) -> Value {
    Value::Object(text.into_iter().collect())
}

/// Ensures every key is a short language code and every value is a Tiptap `doc` node.
pub fn validate_localized_rich_text(text: &LocalizedRichText) -> Result<(), ValidationError> {
    for (lang, doc) in text {
        let valid_lang = (2..=5).contains(&lang.len())
            && lang.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
        if !valid_lang {
            return Err(ValidationError::new("invalid_language_code"));
        }

        let is_doc = doc.get("type").and_then(Value::as_str) == Some("doc");
        if !is_doc {
            return Err(ValidationError::new("invalid_rich_text_document"));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_accepts_tiptap_documents() {
        let text = LocalizedRichText::from([
            ("fi".to_string(), json!({"type": "doc", "content": []})),
            ("en".to_string(), json!({"type": "doc"})),
        ]);
        assert!(validate_localized_rich_text(&text).is_ok());
    }

    #[test]
    fn test_rejects_non_document_values() {
        let text = LocalizedRichText::from([("fi".to_string(), json!("<p>html</p>"))]);
        assert!(validate_localized_rich_text(&text).is_err());
    }

    #[test]
    fn test_rejects_invalid_language_codes() {
        let text = LocalizedRichText::from([("not a lang".to_string(), json!({"type": "doc"}))]);
        assert!(validate_localized_rich_text(&text).is_err());
    }
}
