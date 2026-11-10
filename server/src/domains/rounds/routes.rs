use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use super::{
    db,
    models::{
        AllocatePayload, Allocation, AllocationProposal, CompleteRoundReport, CreateRoundPayload,
        Round, RoundApplication, SaveAllocationPayload, SetPrioritiesPayload, UpdateRoundPayload,
    },
};
use crate::{
    domains::{
        auth::{
            AuthState,
            extractor::{AuthUser, RequireAdmin},
        },
        email_templates::{models::EmailTemplateKey, notify},
    },
    errors::AppError,
};

#[utoipa::path(
    get,
    path = "/rounds",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    responses((status = 200, body = [Round]), (status = 403))
)]
pub async fn list_rounds(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
) -> Result<Json<Vec<Round>>, AppError> {
    Ok(Json(db::list(&auth_state.pool).await?))
}

#[utoipa::path(
    get,
    path = "/rounds/open",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    responses((status = 200, description = "Upcoming and open rounds the caller's group can apply to", body = [Round]))
)]
pub async fn list_open_rounds(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<Round>>, AppError> {
    Ok(Json(
        db::list_open_for_group(&auth_state.pool, auth_user.group_id).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/rounds/{id}",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Round), (status = 404))
)]
pub async fn get_round(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Round>, AppError> {
    let round = db::find(&auth_state.pool, id).await?;
    let is_admin = auth_user.role == crate::domains::users::models::Role::Admin;
    if !is_admin && !round.group_ids.contains(&auth_user.group_id) {
        return Err(AppError::NotFound);
    }
    Ok(Json(round))
}

#[utoipa::path(
    post,
    path = "/rounds",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    request_body = CreateRoundPayload,
    responses((status = 201, body = Round), (status = 400), (status = 403), (status = 409))
)]
pub async fn create_round(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Json(payload): Json<CreateRoundPayload>,
) -> Result<(StatusCode, Json<Round>), AppError> {
    payload.validate()?;
    let round = db::create(&auth_state.pool, payload).await?;
    Ok((StatusCode::CREATED, Json(round)))
}

#[utoipa::path(
    patch,
    path = "/rounds/{id}",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    request_body = UpdateRoundPayload,
    responses((status = 200, body = Round), (status = 404), (status = 409))
)]
pub async fn update_round(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRoundPayload>,
) -> Result<Json<Round>, AppError> {
    payload.validate()?;
    Ok(Json(db::update(&auth_state.pool, id, payload).await?))
}

#[utoipa::path(
    delete,
    path = "/rounds/{id}",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404), (status = 409, description = "The round has applications"))
)]
pub async fn delete_round(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::soft_delete(&auth_state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put,
    path = "/rounds/{id}/priorities",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    request_body = SetPrioritiesPayload,
    responses((status = 204), (status = 400), (status = 403))
)]
pub async fn set_priorities(
    State(auth_state): State<AuthState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetPrioritiesPayload>,
) -> Result<StatusCode, AppError> {
    db::set_priorities(
        &auth_state.pool,
        id,
        auth_user.id,
        payload.resource_id,
        &payload.reservation_ids,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/rounds/{id}/applications",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, description = "All applications of the round, whatever their status", body = [RoundApplication]))
)]
pub async fn list_applications(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<RoundApplication>>, AppError> {
    db::find(&auth_state.pool, id).await?;
    let mut conn = auth_state.pool.acquire().await?;
    Ok(Json(db::list_applications(&mut conn, id, false).await?))
}

#[utoipa::path(
    post,
    path = "/rounds/{id}/allocate",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    request_body = Option<AllocatePayload>,
    responses((status = 200, description = "A randomized proposal; nothing is saved", body = AllocationProposal), (status = 409))
)]
pub async fn allocate_round(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    payload: Option<Json<AllocatePayload>>,
) -> Result<Json<AllocationProposal>, AppError> {
    let seed = payload.and_then(|Json(p)| p.seed);
    Ok(Json(
        db::propose_allocation(&auth_state.pool, id, seed).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/rounds/{id}/allocation",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Allocation))
)]
pub async fn get_allocation(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<Allocation>, AppError> {
    Ok(Json(db::get_allocation(&auth_state.pool, id).await?))
}

#[utoipa::path(
    put,
    path = "/rounds/{id}/allocation",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    request_body = SaveAllocationPayload,
    responses((status = 200, body = Allocation), (status = 400), (status = 409))
)]
pub async fn save_allocation(
    State(auth_state): State<AuthState>,
    RequireAdmin(_admin): RequireAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<SaveAllocationPayload>,
) -> Result<Json<Allocation>, AppError> {
    Ok(Json(
        db::save_allocation(&auth_state.pool, id, &payload.reservation_ids).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/rounds/{id}/complete",
    tag = "Rounds",
    security(("bearer_auth" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, description = "Confirmations and cancellations were applied and emailed", body = CompleteRoundReport), (status = 409))
)]
pub async fn complete_round(
    State(auth_state): State<AuthState>,
    RequireAdmin(admin): RequireAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<CompleteRoundReport>, AppError> {
    let completion = db::complete(&auth_state.pool, id, admin.id).await?;

    for reservation_id in &completion.confirmed {
        notify::spawn_reservation_email(
            &auth_state.pool,
            &auth_state.config,
            EmailTemplateKey::ReservationConfirmed,
            *reservation_id,
        );
    }
    for reservation_id in &completion.cancelled {
        notify::spawn_reservation_email(
            &auth_state.pool,
            &auth_state.config,
            EmailTemplateKey::ReservationCancelled,
            *reservation_id,
        );
    }

    Ok(Json(completion.report))
}
