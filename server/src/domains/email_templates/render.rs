//! Renders Tiptap (ProseMirror) JSON documents into email HTML and plain text.
//!
//! Only the node and mark types produced by the client's StarterKit editor are
//! supported; anything else is rendered as its children. All text is escaped and
//! links are limited to safe schemes, because admins author this content but
//! `{{variables}}` carry user-supplied data.

use std::collections::HashMap;

use serde_json::Value;

pub type Variables = HashMap<&'static str, String>;

pub struct Rendered {
    pub html: String,
    pub text: String,
}

/// Replaces `{{name}}` placeholders; unknown names become empty.
pub fn substitute(input: &str, vars: &Variables) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(start) = rest.find("{{") {
        let Some(len) = rest[start + 2..].find("}}") else {
            break;
        };
        out.push_str(&rest[..start]);
        let name = rest[start + 2..start + 2 + len].trim();
        out.push_str(vars.get(name).map(String::as_str).unwrap_or_default());
        rest = &rest[start + 2 + len + 2..];
    }

    out.push_str(rest);
    out
}

pub fn render(doc: &Value, vars: &Variables) -> Rendered {
    let mut html = String::new();
    let mut text = String::new();
    render_children(doc, vars, &mut html, &mut text, &mut ListContext::default());

    Rendered {
        html: format!(
            r#"<div style="font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #1c1917;">{html}</div>"#
        ),
        text: text.trim().to_string(),
    }
}

#[derive(Default)]
struct ListContext {
    ordered: bool,
    index: usize,
}

fn render_children(
    node: &Value,
    vars: &Variables,
    html: &mut String,
    text: &mut String,
    list: &mut ListContext,
) {
    if let Some(children) = node.get("content").and_then(Value::as_array) {
        for child in children {
            render_node(child, vars, html, text, list);
        }
    }
}

fn render_node(
    node: &Value,
    vars: &Variables,
    html: &mut String,
    text: &mut String,
    list: &mut ListContext,
) {
    match node.get("type").and_then(Value::as_str).unwrap_or_default() {
        "text" => render_text(node, vars, html, text),
        "paragraph" => {
            html.push_str(r#"<p style="margin: 0 0 12px;">"#);
            render_children(node, vars, html, text, list);
            html.push_str("</p>");
            text.push_str("\n\n");
        }
        "heading" => {
            let level = node
                .pointer("/attrs/level")
                .and_then(Value::as_u64)
                .unwrap_or(2)
                .clamp(1, 3);
            html.push_str(&format!(
                r#"<h{level} style="margin: 16px 0 8px; line-height: 1.25;">"#
            ));
            render_children(node, vars, html, text, list);
            html.push_str(&format!("</h{level}>"));
            text.push_str("\n\n");
        }
        "bulletList" | "orderedList" => {
            let ordered = node.get("type").and_then(Value::as_str) == Some("orderedList");
            let tag = if ordered { "ol" } else { "ul" };
            html.push_str(&format!(
                r#"<{tag} style="margin: 0 0 12px; padding-left: 24px;">"#
            ));
            let mut inner = ListContext { ordered, index: 0 };
            render_children(node, vars, html, text, &mut inner);
            html.push_str(&format!("</{tag}>"));
            text.push('\n');
        }
        "listItem" => {
            list.index += 1;
            html.push_str("<li>");
            if list.ordered {
                text.push_str(&format!("{}. ", list.index));
            } else {
                text.push_str("- ");
            }
            let mut item_html = String::new();
            let mut item_text = String::new();
            render_children(
                node,
                vars,
                &mut item_html,
                &mut item_text,
                &mut ListContext::default(),
            );
            // Items hold paragraphs; keep them tight inside the list.
            html.push_str(&item_html.replace(
                r#"<p style="margin: 0 0 12px;">"#,
                r#"<p style="margin: 0;">"#,
            ));
            text.push_str(item_text.trim());
            text.push('\n');
            html.push_str("</li>");
        }
        "blockquote" => {
            html.push_str(r#"<blockquote style="margin: 0 0 12px; padding-left: 12px; border-left: 3px solid #d6d3d1; color: #57534e;">"#);
            render_children(node, vars, html, text, list);
            html.push_str("</blockquote>");
        }
        "codeBlock" => {
            html.push_str(r#"<pre style="margin: 0 0 12px; padding: 8px; background: #f5f5f4; font-family: monospace; white-space: pre-wrap;">"#);
            render_children(node, vars, html, text, list);
            html.push_str("</pre>");
            text.push_str("\n\n");
        }
        "horizontalRule" => {
            html.push_str(
                r#"<hr style="border: 0; border-top: 1px solid #d6d3d1; margin: 16px 0;">"#,
            );
            text.push_str("---\n\n");
        }
        "hardBreak" => {
            html.push_str("<br>");
            text.push('\n');
        }
        _ => render_children(node, vars, html, text, list),
    }
}

fn render_text(node: &Value, vars: &Variables, html: &mut String, text: &mut String) {
    let raw = node.get("text").and_then(Value::as_str).unwrap_or_default();
    let content = substitute(raw, vars);
    let mut rendered = escape_html(&content).replace('\n', "<br>");
    let mut link: Option<String> = None;

    let marks = node.get("marks").and_then(Value::as_array);
    for mark in marks.into_iter().flatten() {
        let tag = match mark.get("type").and_then(Value::as_str).unwrap_or_default() {
            "bold" => "strong",
            "italic" => "em",
            "strike" => "s",
            "underline" => "u",
            "code" => "code",
            "link" => {
                let href = mark
                    .pointer("/attrs/href")
                    .and_then(Value::as_str)
                    .map(|href| substitute(href, vars));
                link = href.filter(|href| is_safe_url(href));
                continue;
            }
            _ => continue,
        };
        rendered = format!("<{tag}>{rendered}</{tag}>");
    }

    match link {
        Some(href) => {
            html.push_str(&format!(
                r##"<a href="{}" style="color: #b45309;">{rendered}</a>"##,
                escape_html(&href)
            ));
            if content == href {
                text.push_str(&content);
            } else {
                text.push_str(&format!("{content} ({href})"));
            }
        }
        None => {
            html.push_str(&rendered);
            text.push_str(&content);
        }
    }
}

fn is_safe_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    ["http://", "https://", "mailto:"]
        .iter()
        .any(|scheme| lower.starts_with(scheme))
}

fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn vars() -> Variables {
        Variables::from([
            ("title", "<script>alert(1)</script> & Co".to_string()),
            ("occurrences", "ma 5.10. 12:00\nti 6.10. 12:00".to_string()),
            (
                "reservation_url",
                "https://kuutar.fi/reservations/1".to_string(),
            ),
        ])
    }

    #[test]
    fn test_substitute_replaces_known_and_blanks_unknown() {
        let vars = Variables::from([("title", "T".to_string())]);
        assert_eq!(substitute("a {{ title }} b {{nope}} c", &vars), "a T b  c");
        assert_eq!(substitute("no braces {{ open", &vars), "no braces {{ open");
    }

    #[test]
    fn test_variable_values_are_escaped() {
        let doc = json!({"type": "doc", "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Hi {{title}}"}]}
        ]});
        let out = render(&doc, &vars());
        assert!(
            out.html
                .contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co")
        );
        assert!(!out.html.contains("<script>"));
        assert!(out.text.contains("Hi <script>alert(1)</script> & Co"));
    }

    #[test]
    fn test_multiline_values_become_line_breaks() {
        let doc = json!({"type": "doc", "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "{{occurrences}}"}]}
        ]});
        let out = render(&doc, &vars());
        assert!(out.html.contains("12:00<br>ti"));
        assert!(out.text.contains("12:00\nti"));
    }

    #[test]
    fn test_marks_and_lists() {
        let doc = json!({"type": "doc", "content": [
            {"type": "paragraph", "content": [
                {"type": "text", "text": "bold", "marks": [{"type": "bold"}]}
            ]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "one"}]}
                ]},
                {"type": "listItem", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "two"}]}
                ]}
            ]}
        ]});
        let out = render(&doc, &vars());
        assert!(out.html.contains("<strong>bold</strong>"));
        assert!(
            out.html
                .contains("<li><p style=\"margin: 0;\">one</p></li>")
        );
        assert!(out.text.contains("- one\n- two"));
    }

    #[test]
    fn test_links_allow_only_safe_schemes() {
        let link = |href: &str| {
            json!({"type": "doc", "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "go", "marks": [{"type": "link", "attrs": {"href": href}}]}
            ]}]})
        };
        let ok = render(&link("{{reservation_url}}"), &vars());
        assert!(
            ok.html
                .contains(r#"href="https://kuutar.fi/reservations/1""#)
        );
        assert!(ok.text.contains("go (https://kuutar.fi/reservations/1)"));

        let bad = render(&link("javascript:alert(1)"), &vars());
        assert!(!bad.html.contains("<a "));
        assert!(!bad.html.contains("javascript"));
    }
}
