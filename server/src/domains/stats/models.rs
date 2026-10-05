use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

/// Time window for usage statistics, counted back from now
#[derive(Debug, Clone, Copy, Default, Deserialize, ToSchema)]
pub enum StatsRange {
    #[serde(rename = "30d")]
    Days30,
    #[default]
    #[serde(rename = "90d")]
    Days90,
    #[serde(rename = "12m")]
    Months12,
    #[serde(rename = "all")]
    All,
}

impl StatsRange {
    /// Start of the window; `None` means unbounded
    pub fn from(self) -> Option<DateTime<Utc>> {
        let days = match self {
            StatsRange::Days30 => 30,
            StatsRange::Days90 => 90,
            StatsRange::Months12 => 365,
            StatsRange::All => return None,
        };
        Some(Utc::now() - Duration::days(days))
    }
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct StatsQuery {
    /// Defaults to `90d`
    #[serde(default)]
    pub range: StatsRange,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UsageTotals {
    /// Occurrences that took place in the range
    pub occurrences: i64,
    pub hours: f64,
    pub resources_used: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyStat {
    /// `YYYY-MM` in Europe/Helsinki
    pub month: String,
    pub count: i64,
    pub hours: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HeatCell {
    /// 0 = Monday … 6 = Sunday
    pub weekday: i32,
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TopResourceStat {
    pub resource_id: Uuid,
    pub resource_name: String,
    pub color: Option<String>,
    pub count: i64,
    pub hours: f64,
}

/// Usage of public resources; visible to everyone
#[derive(Debug, Serialize, ToSchema)]
pub struct PublicStats {
    pub totals: UsageTotals,
    pub public_resources: i64,
    pub monthly: Vec<MonthlyStat>,
    pub weekday_hour: Vec<HeatCell>,
    pub top_resources: Vec<TopResourceStat>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UpcomingOccurrence {
    pub reservation_id: Uuid,
    pub title: String,
    pub resource_name: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatusCounts {
    pub pending: i64,
    pub confirmed: i64,
    pub cancelled: i64,
}

/// The requesting user's own reservations
#[derive(Debug, Serialize, ToSchema)]
pub struct MyStats {
    pub totals: UsageTotals,
    /// Reservations created in the range, by status
    pub statuses: StatusCounts,
    pub monthly: Vec<MonthlyStat>,
    pub favourite_resources: Vec<TopResourceStat>,
    pub upcoming: Vec<UpcomingOccurrence>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct GroupStat {
    pub group_id: Uuid,
    pub group_name: String,
    pub count: i64,
    pub hours: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserStat {
    pub user_id: Uuid,
    pub email: String,
    pub count: i64,
    pub hours: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UnusedResource {
    pub resource_id: Uuid,
    pub resource_name: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NewUsersMonth {
    pub month: String,
    pub count: i64,
}

/// System-wide figures including private resources; admins only
#[derive(Debug, Serialize, ToSchema)]
pub struct AdminStats {
    pub total_users: i64,
    pub total_resources: i64,
    pub total_groups: i64,
    /// Reservations created in the range, by status
    pub statuses: StatusCounts,
    /// Pending reservations right now, regardless of range
    pub pending_now: i64,
    pub oldest_pending_hours: Option<f64>,
    /// Average days between creating a reservation and its occurrences
    pub avg_lead_time_days: Option<f64>,
    pub totals: UsageTotals,
    pub monthly: Vec<MonthlyStat>,
    pub top_resources: Vec<TopResourceStat>,
    pub unused_resources: Vec<UnusedResource>,
    pub groups: Vec<GroupStat>,
    pub top_users: Vec<UserStat>,
    pub new_users: Vec<NewUsersMonth>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatsResponse {
    pub public: PublicStats,
    /// Present for authenticated users
    pub me: Option<MyStats>,
    /// Present for admins
    pub admin: Option<AdminStats>,
}
