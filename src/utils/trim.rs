use serde::{Deserialize, Deserializer};

pub fn deserialize_trimmed_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(s.trim().to_string())
}

pub fn deserialize_trimmed_option_string<'de, D>(
    deserializer: D,
) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    Ok(opt.map(|s| s.trim().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct TestPayload {
        #[serde(deserialize_with = "deserialize_trimmed_string")]
        pub name: String,

        #[serde(default, deserialize_with = "deserialize_trimmed_option_string")]
        pub description: Option<String>,
    }

    #[test]
    fn test_deserialize_trimmed_string_cases() {
        let cases = vec![
            (r#"{"name": "name_a"}"#, "name_a"),
            (r#"{"name": "   name"}"#, "name"),
            (r#"{"name": "name    "}"#, "name"),
            (r#"{"name": "   name    "}"#, "name"),
        ];

        for (json, expected) in cases {
            let parsed: TestPayload = serde_json::from_str(json).unwrap();
            assert_eq!(parsed.name, expected);
        }
    }

    #[test]
    fn test_deserialize_trimmed_option_string_cases() {
        // Test padded string -> trimmed
        let json_padded = r#"{"name": "test", "description": "   hello world   "}"#;
        let parsed: TestPayload = serde_json::from_str(json_padded).unwrap();
        assert_eq!(parsed.description, Some("hello world".to_string()));

        // Test null -> None
        let json_null = r#"{"name": "test", "description": null}"#;
        let parsed: TestPayload = serde_json::from_str(json_null).unwrap();
        assert_eq!(parsed.description, None);

        // Test missing key -> None
        let json_missing = r#"{"name": "test"}"#;
        let parsed: TestPayload = serde_json::from_str(json_missing).unwrap();
        assert_eq!(parsed.description, None);
    }
}
