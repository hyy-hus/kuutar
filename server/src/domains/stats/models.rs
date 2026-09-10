use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, ToSchema)]
pub struct TopResourceStat {
    pub resource_id: Uuid,
    pub resource_name: String,
    pub reservation_count: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SystemStats {
    pub total_reservations: i64,
    pub pending_reservations: i64,
    pub confirmed_reservations: i64,
    pub total_resources: i64,
    pub total_users: i64,
    pub top_resources: Vec<TopResourceStat>,
}
