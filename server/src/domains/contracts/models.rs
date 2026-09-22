use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Map of language codes to localized text (e.g. {"fi": "...", "en": "..."})
pub type LocalizedString = HashMap<String, String>;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Contract {
    pub id: Uuid,
    pub title: serde_json::Value,     // LocalizedString
    pub s3_key: serde_json::Value,    // LocalizedString
    pub file_name: serde_json::Value, // LocalizedString
    pub is_global: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateContract {
    /// Localized titles e.g. {"fi": "Yleiset ehdot", "en": "General Terms"}
    pub title: LocalizedString,

    /// Localized S3 object keys e.g. {"fi": "contracts/ehdot.pdf", "en": "contracts/terms.pdf"}
    pub s3_key: LocalizedString,

    /// Localized original file names e.g. {"fi": "ehdot.pdf", "en": "terms.pdf"}
    pub file_name: LocalizedString,

    #[serde(default)]
    pub is_global: bool,

    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Optional list of resource IDs to link this contract to immediately
    pub resource_ids: Option<Vec<Uuid>>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateContract {
    pub title: Option<LocalizedString>,
    pub s3_key: Option<LocalizedString>,
    pub file_name: Option<LocalizedString>,
    pub is_global: Option<bool>,
    pub is_active: Option<bool>,
    pub resource_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct LinkResourceContracts {
    pub contract_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PresignedUploadRequest {
    pub file_name: String,
    pub content_type: String, // e.g. "application/pdf"
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PresignedUploadResponse {
    pub upload_url: String,
    pub s3_key: String,
}

#[derive(Debug, Deserialize)]
pub struct DownloadQuery {
    pub s3_key: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PresignedDownloadResponse {
    pub download_url: String,
}
