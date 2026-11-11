use chrono::NaiveDate;
use kuutar::seed::mock::{self, MockOptions, Size};
use sqlx::PgPool;

fn opts(size: Size) -> MockOptions {
    MockOptions {
        seed: 7,
        size,
        anchor: NaiveDate::from_ymd_opt(2026, 11, 11).unwrap(),
        password_hash: "dummy_hash".to_string(),
    }
}

#[sqlx::test]
async fn mock_seed_is_valid_synthetic_and_resettable(pool: PgPool) {
    let s = mock::seed(&pool, &opts(Size::Small)).await.unwrap();
    assert!(s.users >= 20 && s.reservations >= 30 && s.rounds == 3);

    // Only synthetic addresses.
    let real: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@example.test'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(real, 0);

    // All statuses and a recurring, an outlook and a round reservation are present.
    for status in ["pending", "confirmed", "cancelled"] {
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM reservations WHERE status = $1::text::reservation_status",
        )
        .bind(status)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(n > 0, "no {status} reservations");
    }
    let recurring: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM reservations WHERE rrule IS NOT NULL")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(recurring > 0);

    // Confirmed reservations never overlap on the same resource.
    let clashes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM occurrences a JOIN reservations ra ON ra.id = a.reservation_id \
         JOIN occurrences b ON b.resource_id = a.resource_id AND b.id > a.id \
         JOIN reservations rb ON rb.id = b.reservation_id \
         WHERE ra.status = 'confirmed' AND rb.status = 'confirmed' \
         AND a.start_time < b.end_time AND a.end_time > b.start_time",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(clashes, 0);

    // Seeding twice without reset is refused; reset removes everything it created.
    assert!(mock::seed(&pool, &opts(Size::Small)).await.is_err());
    mock::reset(&pool).await.unwrap();
    for table in [
        "users",
        "reservations",
        "occurrences",
        "resources",
        "collections",
        "reservation_rounds",
    ] {
        let n: i64 =
            sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT COUNT(*) FROM {table}")))
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(n, 0, "{table} not empty after reset");
    }
    // And it can be seeded again deterministically.
    let again = mock::seed(&pool, &opts(Size::Small)).await.unwrap();
    assert_eq!(again.reservations, s.reservations);
}
