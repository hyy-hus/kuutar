mod common;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use chrono::{DateTime, Duration, Utc};
use common::{create_group, test_config};
use kuutar::app;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn insert_restriction(
    pool: &PgPool,
    title: &str,
    occurrences: &[(Option<Uuid>, DateTime<Utc>)],
    exempt: &[Uuid],
) -> Uuid {
    let id: Uuid = sqlx::query_scalar("INSERT INTO restrictions (title) VALUES ($1) RETURNING id")
        .bind(title)
        .fetch_one(pool)
        .await
        .unwrap();
    for (resource_id, start) in occurrences {
        sqlx::query(
            "INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(id)
        .bind(resource_id)
        .bind(start)
        .bind(*start + Duration::hours(2))
        .execute(pool)
        .await
        .unwrap();
    }
    for group_id in exempt {
        sqlx::query(
            "INSERT INTO restriction_exemptions (restriction_id, group_id) VALUES ($1, $2)",
        )
        .bind(id)
        .bind(group_id)
        .execute(pool)
        .await
        .unwrap();
    }
    id
}

async fn list(app: &axum::Router, query: &str) -> Vec<Value> {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/restrictions?{query}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice::<Value>(&body)
        .unwrap()
        .as_array()
        .unwrap()
        .clone()
}

fn sorted_strings(value: &Value) -> Vec<String> {
    let mut v: Vec<String> = value
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x.as_str().unwrap().to_string())
        .collect();
    v.sort();
    v
}

#[sqlx::test]
async fn test_list_restrictions_with_occurrences_and_exemptions(pool: PgPool) {
    let collection_id: Uuid =
        sqlx::query_scalar("INSERT INTO collections (name) VALUES ('C') RETURNING id")
            .fetch_one(&pool)
            .await
            .unwrap();
    let mut resources = Vec::new();
    for name in ["Hall", "Sauna"] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO resources (collection_id, name) VALUES ($1, $2) RETURNING id",
        )
        .bind(collection_id)
        .bind(name)
        .fetch_one(&pool)
        .await
        .unwrap();
        resources.push(id);
    }
    let (hall, sauna) = (resources[0], resources[1]);
    let (g1, g2) = (create_group(&pool).await, create_group(&pool).await);

    let base = DateTime::parse_from_rfc3339("2030-05-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let in_window = base + Duration::days(2);
    let outside = base + Duration::days(60);

    let on_hall = insert_restriction(
        &pool,
        "Hall renovation",
        &[
            (Some(hall), base + Duration::days(5)),
            (Some(hall), in_window),
            (Some(hall), outside),
        ],
        &[g1, g2],
    )
    .await;
    let everywhere = insert_restriction(&pool, "Closed", &[(None, in_window)], &[]).await;
    let on_sauna = insert_restriction(
        &pool,
        "Sauna maintenance",
        &[(Some(sauna), in_window)],
        &[g2],
    )
    .await;
    insert_restriction(&pool, "Later", &[(Some(hall), outside)], &[]).await;

    let app = app(pool, test_config());
    let window = "start_date=2030-05-01T00:00:00Z&end_date=2030-05-31T00:00:00Z";

    // Without a resource filter: every restriction with an occurrence in the window, by id
    let all = list(&app, window).await;
    let mut expected = vec![on_hall, everywhere, on_sauna];
    expected.sort();
    let ids: Vec<Uuid> = all
        .iter()
        .map(|r| r["id"].as_str().unwrap().parse().unwrap())
        .collect();
    assert_eq!(ids, expected);

    let hall_restriction = all
        .iter()
        .find(|r| r["title"] == "Hall renovation")
        .unwrap();
    // All occurrences of a matching restriction are returned, in time order
    let starts: Vec<&str> = hall_restriction["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .map(|o| o["start_time"].as_str().unwrap())
        .collect();
    assert_eq!(starts.len(), 3);
    assert!(starts.windows(2).all(|w| w[0] < w[1]), "{starts:?}");
    let mut groups = vec![g1.to_string(), g2.to_string()];
    groups.sort();
    assert_eq!(
        sorted_strings(&hall_restriction["exempt_group_ids"]),
        groups
    );

    let sauna_restriction = all
        .iter()
        .find(|r| r["title"] == "Sauna maintenance")
        .unwrap();
    assert_eq!(
        sorted_strings(&sauna_restriction["exempt_group_ids"]),
        vec![g2.to_string()]
    );
    let closed = all.iter().find(|r| r["title"] == "Closed").unwrap();
    assert!(closed["exempt_group_ids"].as_array().unwrap().is_empty());
    assert!(closed["occurrences"][0]["resource_id"].is_null());

    // A resource filter keeps restrictions on that resource and those on every resource
    let hall_only = list(&app, &format!("{window}&resource_id={hall}")).await;
    let mut titles: Vec<&str> = hall_only
        .iter()
        .map(|r| r["title"].as_str().unwrap())
        .collect();
    titles.sort();
    assert_eq!(titles, vec!["Closed", "Hall renovation"]);

    // An empty window returns nothing
    assert!(
        list(
            &app,
            "start_date=2031-01-01T00:00:00Z&end_date=2031-01-02T00:00:00Z"
        )
        .await
        .is_empty()
    );
}

async fn send(
    app: &axum::Router,
    method: &str,
    uri: &str,
    token: &str,
    body: Value,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header("authorization", token)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&body).unwrap_or(Value::Null))
}

#[sqlx::test]
async fn test_create_and_update_restriction_occurrences_and_exemptions(pool: PgPool) {
    let admin = common::setup_admin_token(&pool).await;
    let collection_id: Uuid =
        sqlx::query_scalar("INSERT INTO collections (name) VALUES ('C') RETURNING id")
            .fetch_one(&pool)
            .await
            .unwrap();
    let hall: Uuid = sqlx::query_scalar(
        "INSERT INTO resources (collection_id, name) VALUES ($1, 'Hall') RETURNING id",
    )
    .bind(collection_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let (g1, g2, g3) = (
        create_group(&pool).await,
        create_group(&pool).await,
        create_group(&pool).await,
    );
    let base = Utc::now() + Duration::days(10);
    let occ = |resource: Option<Uuid>, h: i64| {
        serde_json::json!({
            "resource_id": resource,
            "start_time": base + Duration::hours(h),
            "end_time": base + Duration::hours(h + 2),
        })
    };
    let app = app(pool, test_config());

    let (status, created) = send(
        &app,
        "POST",
        "/restrictions",
        &admin,
        serde_json::json!({
            "title": "Exams",
            "exempt_group_ids": [g1, g2],
            "occurrences": [occ(Some(hall), 24), occ(None, 0), occ(Some(hall), 48)],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let occurrences = created["occurrences"].as_array().unwrap();
    assert_eq!(occurrences.len(), 3);
    // Returned in time order, the global one without a resource
    assert!(occurrences[0]["resource_id"].is_null());
    assert_eq!(occurrences[1]["resource_id"], hall.to_string());
    let mut expected = vec![g1.to_string(), g2.to_string()];
    expected.sort();
    assert_eq!(sorted_strings(&created["exempt_group_ids"]), expected);

    let id = created["id"].as_str().unwrap();
    let (status, updated) = send(
        &app,
        "PATCH",
        &format!("/restrictions/{id}"),
        &admin,
        serde_json::json!({
            "exempt_group_ids": [g3],
            "occurrences": [occ(None, 72), occ(Some(hall), 96)],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["occurrences"].as_array().unwrap().len(), 2);
    assert!(updated["occurrences"][0]["resource_id"].is_null());
    assert_eq!(
        sorted_strings(&updated["exempt_group_ids"]),
        vec![g3.to_string()]
    );
}
