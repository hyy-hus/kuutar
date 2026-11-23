//! Placeholders for secret values in hand-written `Debug` impls.
//!
//! Request payloads end up in log lines through `#[tracing::instrument]`, so structs that
//! carry passwords, tokens or one-time codes print these instead of the value.

use std::fmt;

/// Prints `<redacted>` in place of a secret.
pub struct Redacted;

impl fmt::Debug for Redacted {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("<redacted>")
    }
}

/// Keeps `None` visible but hides the value of `Some`.
pub fn redact_option<T>(value: &Option<T>) -> Option<Redacted> {
    value.as_ref().map(|_| Redacted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacted_hides_value() {
        assert_eq!(format!("{:?}", Redacted), "<redacted>");
        assert_eq!(
            format!("{:?}", redact_option(&Some("secret"))),
            "Some(<redacted>)"
        );
        assert_eq!(format!("{:?}", redact_option::<String>(&None)), "None");
    }
}
