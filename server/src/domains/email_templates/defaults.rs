//! Built-in email templates, used until an admin saves their own version.

use std::collections::HashMap;

use serde_json::{Value, json};

use super::models::EmailTemplateKey;
use crate::utils::rich_text::LocalizedRichText;

/// Placeholders available in every reservation email.
pub const VARIABLES: [&str; 6] = [
    "user_name",
    "title",
    "status",
    "contact_person",
    "occurrences",
    "reservation_url",
];

fn text(value: &str) -> Value {
    json!({"type": "text", "text": value})
}

fn paragraph(value: &str) -> Value {
    json!({"type": "paragraph", "content": [text(value)]})
}

fn link_paragraph(label: &str) -> Value {
    json!({"type": "paragraph", "content": [{
        "type": "text",
        "text": label,
        "marks": [{"type": "link", "attrs": {"href": "{{reservation_url}}"}}]
    }]})
}

fn doc(intro: &str, link_label: &str) -> Value {
    json!({"type": "doc", "content": [
        paragraph("{{user_name}}"),
        paragraph(intro),
        paragraph("{{occurrences}}"),
        link_paragraph(link_label),
    ]})
}

pub fn default_subject(key: EmailTemplateKey) -> HashMap<String, String> {
    let pairs = match key {
        EmailTemplateKey::ReservationCreated => [
            ("fi", "Varaus vastaanotettu: {{title}}"),
            ("sv", "Bokning mottagen: {{title}}"),
            ("en", "Reservation received: {{title}}"),
        ],
        EmailTemplateKey::ReservationConfirmed => [
            ("fi", "Varaus vahvistettu: {{title}}"),
            ("sv", "Bokning bekräftad: {{title}}"),
            ("en", "Reservation confirmed: {{title}}"),
        ],
        EmailTemplateKey::ReservationCancelled => [
            ("fi", "Varaus peruttu: {{title}}"),
            ("sv", "Bokning avbokad: {{title}}"),
            ("en", "Reservation cancelled: {{title}}"),
        ],
    };
    pairs
        .into_iter()
        .map(|(lang, subject)| (lang.to_string(), subject.to_string()))
        .collect()
}

pub fn default_body(key: EmailTemplateKey) -> LocalizedRichText {
    let entries = match key {
        EmailTemplateKey::ReservationCreated => [
            (
                "fi",
                "Hei,",
                "Olemme vastaanottaneet varauksesi {{title}}. Varaus odottaa hyväksyntää, ja saat vahvistuksen sähköpostitse, kun se on käsitelty.",
                "Näytä varaus",
            ),
            (
                "sv",
                "Hej,",
                "Vi har tagit emot din bokning {{title}}. Bokningen väntar på godkännande och du får en bekräftelse per e-post när den har behandlats.",
                "Visa bokning",
            ),
            (
                "en",
                "Hello,",
                "We have received your reservation {{title}}. It is awaiting approval, and you will receive an email once it has been processed.",
                "View reservation",
            ),
        ],
        EmailTemplateKey::ReservationConfirmed => [
            (
                "fi",
                "Hei,",
                "Varauksesi {{title}} on vahvistettu.",
                "Näytä varaus",
            ),
            (
                "sv",
                "Hej,",
                "Din bokning {{title}} har bekräftats.",
                "Visa bokning",
            ),
            (
                "en",
                "Hello,",
                "Your reservation {{title}} has been confirmed.",
                "View reservation",
            ),
        ],
        EmailTemplateKey::ReservationCancelled => [
            (
                "fi",
                "Hei,",
                "Varauksesi {{title}} on peruttu.",
                "Näytä varaus",
            ),
            (
                "sv",
                "Hej,",
                "Din bokning {{title}} har avbokats.",
                "Visa bokning",
            ),
            (
                "en",
                "Hello,",
                "Your reservation {{title}} has been cancelled.",
                "View reservation",
            ),
        ],
    };
    entries
        .into_iter()
        .map(|(lang, greeting, intro, link)| {
            let mut document = doc(intro, link);
            document["content"][0] = paragraph(greeting);
            (lang.to_string(), document)
        })
        .collect()
}
