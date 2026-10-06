//! Microsoft Graph access to the intake mailbox (app-only, client credentials).

use std::time::{Duration, Instant};

use async_trait::async_trait;
use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::config::Config;

#[derive(Debug, thiserror::Error)]
pub enum GraphError {
    #[error("Graph is not configured")]
    NotConfigured,
    #[error("Graph request failed: {0}")]
    Request(String),
}

impl From<reqwest::Error> for GraphError {
    fn from(err: reqwest::Error) -> Self {
        // reqwest errors can embed the URL; the message is enough for the audit log
        GraphError::Request(err.without_url().to_string())
    }
}

#[derive(Debug, Clone)]
pub struct InboxMessage {
    pub id: String,
    pub subject: Option<String>,
    pub received_at: Option<DateTime<Utc>>,
}

/// The mailbox operations the importer needs; faked in tests.
#[async_trait]
pub trait OutlookClient: Send + Sync {
    /// Unread messages in the intake inbox, oldest first.
    async fn list_unread(&self) -> Result<Vec<InboxMessage>, GraphError>;

    /// Text of every `.ics` attachment of the message.
    async fn calendar_attachments(&self, message_id: &str) -> Result<Vec<String>, GraphError>;

    /// Takes the message out of the unread inbox so it is not processed again.
    async fn mark_processed(&self, message_id: &str) -> Result<(), GraphError>;
}

struct Token {
    value: String,
    expires_at: Instant,
}

pub struct GraphClient {
    http: reqwest::Client,
    base_url: String,
    login_url: String,
    tenant_id: String,
    client_id: String,
    client_secret: String,
    mailbox: String,
    token: Mutex<Option<Token>>,
}

impl GraphClient {
    pub fn from_config(config: &Config) -> Result<Self, GraphError> {
        match (
            &config.graph_tenant_id,
            &config.graph_client_id,
            &config.graph_client_secret,
            &config.graph_intake_mailbox,
        ) {
            (Some(tenant), Some(id), Some(secret), Some(mailbox)) => Ok(Self {
                http: reqwest::Client::builder()
                    .timeout(Duration::from_secs(30))
                    .build()?,
                base_url: config.graph_base_url.trim_end_matches('/').to_string(),
                login_url: config.graph_login_url.trim_end_matches('/').to_string(),
                tenant_id: tenant.clone(),
                client_id: id.clone(),
                client_secret: secret.clone(),
                mailbox: mailbox.clone(),
                token: Mutex::new(None),
            }),
            _ => Err(GraphError::NotConfigured),
        }
    }

    async fn access_token(&self) -> Result<String, GraphError> {
        let mut cached = self.token.lock().await;
        if let Some(t) = cached.as_ref()
            && t.expires_at > Instant::now() + Duration::from_secs(60)
        {
            return Ok(t.value.clone());
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            expires_in: u64,
        }

        let response = self
            .http
            .post(format!(
                "{}/{}/oauth2/v2.0/token",
                self.login_url, self.tenant_id
            ))
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("scope", "https://graph.microsoft.com/.default"),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await?;
        if !response.status().is_success() {
            return Err(GraphError::Request(format!(
                "token request returned {}",
                response.status()
            )));
        }
        let body: TokenResponse = response.json().await?;

        *cached = Some(Token {
            value: body.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(body.expires_in),
        });
        Ok(body.access_token)
    }

    fn mailbox_url(&self, path: &str) -> String {
        format!("{}/users/{}{path}", self.base_url, self.mailbox)
    }

    async fn check(response: reqwest::Response) -> Result<reqwest::Response, GraphError> {
        if response.status().is_success() {
            Ok(response)
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(GraphError::Request(format!(
                "{status}: {}",
                body.chars().take(300).collect::<String>()
            )))
        }
    }
}

#[derive(Deserialize)]
struct List<T> {
    value: Vec<T>,
}

#[async_trait]
impl OutlookClient for GraphClient {
    async fn list_unread(&self) -> Result<Vec<InboxMessage>, GraphError> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Message {
            id: String,
            subject: Option<String>,
            received_date_time: Option<DateTime<Utc>>,
        }

        let response = self
            .http
            .get(self.mailbox_url("/mailFolders/inbox/messages"))
            .bearer_auth(self.access_token().await?)
            .query(&[
                ("$filter", "isRead eq false"),
                ("$select", "id,subject,receivedDateTime"),
                ("$top", "25"),
            ])
            .send()
            .await?;
        let mut messages: Vec<InboxMessage> = Self::check(response)
            .await?
            .json::<List<Message>>()
            .await?
            .value
            .into_iter()
            .map(|m| InboxMessage {
                id: m.id,
                subject: m.subject,
                received_at: m.received_date_time,
            })
            .collect();
        messages.sort_by_key(|m| m.received_at);
        Ok(messages)
    }

    async fn calendar_attachments(&self, message_id: &str) -> Result<Vec<String>, GraphError> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Attachment {
            name: Option<String>,
            content_type: Option<String>,
            content_bytes: Option<String>,
        }

        let response = self
            .http
            .get(self.mailbox_url(&format!("/messages/{message_id}/attachments")))
            .bearer_auth(self.access_token().await?)
            .send()
            .await?;
        let attachments = Self::check(response)
            .await?
            .json::<List<Attachment>>()
            .await?
            .value;

        Ok(attachments
            .into_iter()
            .filter(|a| {
                a.content_type
                    .as_deref()
                    .is_some_and(|t| t.to_ascii_lowercase().starts_with("text/calendar"))
                    || a.name
                        .as_deref()
                        .is_some_and(|n| n.to_ascii_lowercase().ends_with(".ics"))
            })
            .filter_map(|a| a.content_bytes)
            .filter_map(|b64| STANDARD.decode(b64.trim()).ok())
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
            .collect())
    }

    async fn mark_processed(&self, message_id: &str) -> Result<(), GraphError> {
        let token = self.access_token().await?;

        let moved = self
            .http
            .post(self.mailbox_url(&format!("/messages/{message_id}/move")))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "destinationId": "archive" }))
            .send()
            .await?;
        if moved.status().is_success() {
            return Ok(());
        }

        // No archive folder: at least stop it from showing up as unread
        let read = self
            .http
            .patch(self.mailbox_url(&format!("/messages/{message_id}")))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "isRead": true }))
            .send()
            .await?;
        Self::check(read).await.map(|_| ())
    }
}
