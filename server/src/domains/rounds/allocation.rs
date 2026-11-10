//! The randomized allocation of a round, kept free of I/O so it can be tested directly.

use std::collections::{HashMap, HashSet};

use uuid::Uuid;

use super::models::RoundApplication;

/// splitmix64: a tiny deterministic generator, enough for a reproducible shuffle.
struct SplitMix64(u64);

impl SplitMix64 {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

/// Shuffles the applicants once, then in that order gives each user, for every resource they
/// applied to, their best-ranked application whose slot is still free (one per user and
/// resource). `unavailable` holds slots (resource, start) that are already taken elsewhere.
///
/// Returns the reservation ids to grant. Deterministic for a given seed and input.
pub fn allocate(
    applications: &[RoundApplication],
    unavailable: &HashSet<(Uuid, chrono::DateTime<chrono::Utc>)>,
    seed: u64,
) -> Vec<Uuid> {
    // Stable base order so the same seed always yields the same shuffle
    let mut users: Vec<Uuid> = applications.iter().map(|a| a.user_id).collect();
    users.sort();
    users.dedup();

    let mut rng = SplitMix64(seed);
    for i in (1..users.len()).rev() {
        users.swap(i, rng.below(i + 1));
    }

    let mut by_user: HashMap<Uuid, Vec<&RoundApplication>> = HashMap::new();
    for app in applications {
        by_user.entry(app.user_id).or_default().push(app);
    }

    let mut taken: HashSet<(Uuid, chrono::DateTime<chrono::Utc>)> = unavailable.clone();
    let mut granted = Vec::new();

    for user in users {
        let mut apps = by_user.remove(&user).unwrap_or_default();
        apps.sort_by_key(|a| (a.priority, a.start_time, a.reservation_id));
        let mut resources_done: HashSet<Uuid> = HashSet::new();
        for app in apps {
            if resources_done.contains(&app.resource_id) {
                continue;
            }
            if taken.insert((app.resource_id, app.start_time)) {
                resources_done.insert(app.resource_id);
                granted.push(app.reservation_id);
            }
        }
    }

    granted
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};

    use super::*;

    fn app(user: u128, resource: u128, hour: u32, priority: i32) -> RoundApplication {
        let start = Utc.with_ymd_and_hms(2026, 12, 1, hour, 0, 0).unwrap();
        RoundApplication {
            reservation_id: Uuid::from_u128(user * 1000 + hour as u128 + resource * 100_000),
            user_id: Uuid::from_u128(user),
            user_name: None,
            user_email: None,
            title: String::new(),
            description: None,
            message_to_admins: None,
            admin_notes: None,
            contact_person: None,
            contact_email: None,
            contact_phone: None,
            status: crate::domains::reservations::models::ReservationStatus::Pending,
            resource_id: Uuid::from_u128(resource),
            start_time: start,
            end_time: start + chrono::TimeDelta::hours(1),
            priority,
            externally_taken: false,
        }
    }

    #[test]
    fn deterministic_for_seed() {
        let apps = vec![app(1, 1, 10, 1), app(2, 1, 10, 1), app(3, 1, 10, 1)];
        let a = allocate(&apps, &HashSet::new(), 42);
        let b = allocate(&apps, &HashSet::new(), 42);
        assert_eq!(a, b);
        assert_eq!(a.len(), 1);
    }

    #[test]
    fn falls_back_to_next_priority_and_one_per_resource() {
        // Both want 10:00 first; the loser gets 11:00. Nobody gets two slots on a resource.
        let apps = vec![
            app(1, 1, 10, 1),
            app(1, 1, 11, 2),
            app(2, 1, 10, 1),
            app(2, 1, 11, 2),
        ];
        let granted = allocate(&apps, &HashSet::new(), 7);
        assert_eq!(granted.len(), 2);
        let slots: HashSet<_> = apps
            .iter()
            .filter(|a| granted.contains(&a.reservation_id))
            .map(|a| a.start_time)
            .collect();
        assert_eq!(slots.len(), 2);
    }

    #[test]
    fn skips_unavailable_slots() {
        let apps = vec![app(1, 1, 10, 1), app(1, 1, 11, 2)];
        let blocked = HashSet::from([(Uuid::from_u128(1), apps[0].start_time)]);
        let granted = allocate(&apps, &blocked, 1);
        assert_eq!(granted, vec![apps[1].reservation_id]);
    }

    #[test]
    fn every_user_can_win_first() {
        // Over many seeds each of the two contenders wins the contested slot sometimes
        let apps = vec![app(1, 1, 10, 1), app(2, 1, 10, 1)];
        let winners: HashSet<_> = (0..50)
            .map(|seed| allocate(&apps, &HashSet::new(), seed)[0])
            .collect();
        assert_eq!(winners.len(), 2);
    }
}
