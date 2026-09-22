use std::time::Duration;

use aws_sdk_s3::presigning::PresigningConfig;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{Contract, CreateContract, UpdateContract},
};
use crate::{
    domains::{
        auth::{AuthState, extractor::RequireAdmin},
        contracts::models::{
            DownloadQuery, PresignedDownloadResponse, PresignedUploadRequest,
            PresignedUploadResponse,
        },
    },
    errors::AppError,
};

#[derive(Debug, Deserialize)]
pub struct ListContractsQuery {
    pub resource_id: Option<Uuid>,
    pub active_only: Option<bool>,
}

/// GET /contracts
#[utoipa::path(
    get,
    path = "/contracts",
    tag = "Contracts",
    params(
        ("resource_id" = Option<Uuid>, Query, description = "Filter by specific resource ID"),
        ("active_only" = Option<bool>, Query, description = "Filter active contracts only")
    ),
    responses(
        (status = 200, description = "List of active contracts", body = [Contract]),
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn list_contracts(
    State(auth_state): State<AuthState>,
    Query(query): Query<ListContractsQuery>,
) -> Result<Json<Vec<Contract>>, AppError> {
    let active_only = query.active_only.unwrap_or(true);
    let contracts = db::list_all(&auth_state.pool, query.resource_id, active_only).await?;
    Ok(Json(contracts))
}

/// GET /contracts/{id}
#[utoipa::path(
    get,
    path = "/contracts/{id}",
    tag = "Contracts",
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    responses(
        (status = 200, description = "Contract details", body = Contract),
        (status = 404, description = "Contract not found")
    )
)]
#[tracing::instrument(skip(auth_state))]
pub async fn get_contract(
    State(auth_state): State<AuthState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Contract>, AppError> {
    let contract = db::find_by_id(&auth_state.pool, id).await?;
    Ok(Json(contract))
}

/// POST /contracts
#[utoipa::path(
    post,
    path = "/contracts",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    request_body = CreateContract,
    responses(
        (status = 201, description = "Contract created successfully", body = Contract),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn create_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateContract>,
) -> Result<(StatusCode, Json<Contract>), AppError> {
    payload.validate()?;
    let contract = db::create(&auth_state.pool, payload).await?;

    Ok((StatusCode::CREATED, Json(contract)))
}

/// PATCH /contracts/{id}
#[utoipa::path(
    patch,
    path = "/contracts/{id}",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    request_body = UpdateContract,
    responses(
        (status = 200, description = "Contract updated successfully", body = Contract),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Contract not found"),
        (status = 422, description = "Validation error")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn update_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateContract>,
) -> Result<Json<Contract>, AppError> {
    payload.validate()?;
    let contract = db::update(&auth_state.pool, id, payload).await?;

    Ok(Json(contract))
}

/// DELETE /contracts/{id}
#[utoipa::path(
    delete,
    path = "/contracts/{id}",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Contract UUID")
    ),
    responses(
        (status = 204, description = "Contract soft-deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required"),
        (status = 404, description = "Contract not found")
    )
)]
#[tracing::instrument(skip(auth_state, _admin))]
pub async fn delete_contract(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /contracts/presign-upload
#[utoipa::path(
    post,
    path = "/contracts/presign-upload",
    tag = "Contracts",
    security(("bearer_auth" = [])),
    request_body = PresignedUploadRequest,
    responses(
        (status = 200, description = "Presigned URL generated successfully", body = PresignedUploadResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - Admin access required")
    )
)]
pub async fn generate_upload_url(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<PresignedUploadRequest>,
) -> Result<Json<PresignedUploadResponse>, AppError> {
    let s3_key = format!("contracts/{}-{}", Uuid::new_v4(), payload.file_name);

    // Initialize Scaleway S3 client config
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(&auth_state.config.s3_endpoint) // e.g. "https://s3.fr-par.scw.cloud"
        .region(aws_sdk_s3::config::Region::new(
            auth_state.config.s3_region.clone(),
        ))
        .load()
        .await;

    let client = aws_sdk_s3::Client::new(&config);

    let presigned_req = client
        .put_object()
        .bucket(&auth_state.config.s3_bucket_name)
        .key(&s3_key)
        .content_type(&payload.content_type)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(900)).unwrap())
        .await
        .map_err(|e| AppError::InternalServerError(format!("S3 presign error: {e}")))?;

    Ok(Json(PresignedUploadResponse {
        upload_url: presigned_req.uri().to_string(),
        s3_key,
    }))
}

/// GET /contracts/download
#[utoipa::path(
    get,
    path = "/contracts/download",
    tag = "Contracts",
    params(
        ("s3_key" = String, Query, description = "S3 Object Key to generate download URL for")
    ),
    responses(
        (status = 200, description = "Presigned download URL generated successfully", body = PresignedDownloadResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn generate_download_url(
    State(auth_state): State<AuthState>,
    Query(query): Query<DownloadQuery>,
) -> Result<Json<PresignedDownloadResponse>, AppError> {
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(&auth_state.config.s3_endpoint)
        .region(aws_sdk_s3::config::Region::new(
            auth_state.config.s3_region.clone(),
        ))
        .load()
        .await;

    let client = aws_sdk_s3::Client::new(&config);

    let presigned_req = client
        .get_object()
        .bucket(&auth_state.config.s3_bucket_name) // Uses S3_BUCKET_NAME from Config (.env)
        .key(&query.s3_key)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(900)).unwrap())
        .await
        .map_err(|e| AppError::InternalServerError(format!("S3 presign error: {e}")))?;

    Ok(Json(PresignedDownloadResponse {
        download_url: presigned_req.uri().to_string(),
    }))
}

/// GET /contracts/static/*s3_key
pub async fn static_contract(
    State(auth_state): State<AuthState>,
    Path(s3_key): Path<String>,
) -> Result<Response, AppError> {
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(&auth_state.config.s3_endpoint)
        .region(aws_sdk_s3::config::Region::new(
            auth_state.config.s3_region.clone(),
        ))
        .load()
        .await;

    let client = aws_sdk_s3::Client::new(&config);

    let presigned_req = client
        .get_object()
        .bucket(&auth_state.config.s3_bucket_name)
        .key(&s3_key)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(900)).unwrap())
        .await
        .map_err(|e| AppError::InternalServerError(format!("S3 presign error: {e}")))?;

    let download_url = presigned_req.uri().to_string();

    // Redirect browser directly to the short-lived S3 URL
    Ok(Redirect::temporary(&download_url).into_response())
}
