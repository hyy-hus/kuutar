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

/// Wraps plain text, e.g. a description written before rich text existed, into a Finnish
/// document with one paragraph per non-empty line. Empty text gives an empty map.
pub fn from_plain_text(text: &str) -> LocalizedRichText {
    let paragraphs: Vec<Value> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| serde_json::json!({"type": "paragraph", "content": [{"type": "text", "text": line}]}))
        .collect();

    if paragraphs.is_empty() {
        return LocalizedRichText::new();
    }

    LocalizedRichText::from([(
        "fi".to_string(),
        serde_json::json!({"type": "doc", "content": paragraphs}),
    )])
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
    fn test_plain_text_becomes_one_paragraph_per_line() {
        let text = from_plain_text("First\n\n  Second  \r\n");
        let doc = &text["fi"];
        assert!(validate_localized_rich_text(&text).is_ok());
        assert_eq!(doc["content"].as_array().unwrap().len(), 2);
        assert_eq!(doc["content"][1]["content"][0]["text"], "Second");
    }

    #[test]
    fn test_blank_plain_text_is_empty() {
        assert!(from_plain_text("  \n \n").is_empty());
        assert!(from_plain_text("").is_empty());
    }

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
