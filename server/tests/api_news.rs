mod common;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use common::{create_group, setup_user_in_group, setup_user_token, test_config};
use kuutar::{app, domains::users::models::Role};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn request(
    app: &Router,
    method: &str,
    uri: &str,
    auth: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(auth) = auth {
        builder = builder.header(header::AUTHORIZATION, auth);
    }
    let body = match body {
        Some(json) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
        }
        None => Body::empty(),
    };
    let response = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

struct Env {
    app: Router,
    pool: PgPool,
    admin: String,
    /// User in `group`
    member: String,
    member_id: Uuid,
    /// User in an unrelated group
    other: String,
    group: Uuid,
}

async fn setup(pool: PgPool) -> Env {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let group = create_group(&pool).await;
    let (member, member_id) = setup_user_in_group(&pool, Role::User, group).await;
    let (other, _, _) = setup_user_token(&pool, Role::User).await;
    // Accounts that predate the test items, so the items count as unread
    sqlx::query!("UPDATE users SET created_at = NOW() - INTERVAL '1 year'")
        .execute(&pool)
        .await
        .unwrap();
    let app = app(pool.clone(), test_config());
    Env {
        app,
        pool,
        admin,
        member,
        member_id,
        other,
        group,
    }
}

impl Env {
    async fn create(&self, title: &str, extra: Value) -> Uuid {
        let mut body = json!({
            "title": {"fi": title},
            "blurb": {"fi": format!("{title} lyhyesti")},
            "visibility": "public",
            "published_at": Utc::now() - Duration::hours(1),
        });
        body.as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let (status, item) =
            request(&self.app, "POST", "/news", Some(&self.admin), Some(body)).await;
        assert_eq!(status, StatusCode::CREATED, "{item}");
        item["id"].as_str().unwrap().parse().unwrap()
    }

    async fn titles(&self, auth: Option<&str>) -> Vec<String> {
        let (status, list) = request(&self.app, "GET", "/news", auth, None).await;
        assert_eq!(status, StatusCode::OK);
        let mut titles: Vec<String> = list
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["title"]["fi"].as_str().unwrap().to_string())
            .collect();
        titles.sort();
        titles
    }

    async fn unread(&self, auth: &str) -> i64 {
        let (status, body) =
            request(&self.app, "GET", "/news/unread-count", Some(auth), None).await;
        assert_eq!(status, StatusCode::OK);
        body["count"].as_i64().unwrap()
    }
}

/// One item per visibility level, plus a draft and a scheduled item
async fn create_all_kinds(env: &Env) -> [Uuid; 5] {
    [
        env.create("public", json!({})).await,
        env.create("users", json!({"visibility": "users"})).await,
        env.create(
            "groups",
            json!({"visibility": "groups", "visible_group_ids": [env.group]}),
        )
        .await,
        env.create("draft", json!({"published_at": null})).await,
        env.create(
            "scheduled",
            json!({"published_at": Utc::now() + Duration::days(1)}),
        )
        .await,
    ]
}

#[sqlx::test]
async fn test_visibility_per_viewer(pool: PgPool) {
    let env = setup(pool).await;
    create_all_kinds(&env).await;

    assert_eq!(env.titles(None).await, ["public"]);
    assert_eq!(env.titles(Some(&env.other)).await, ["public", "users"]);
    assert_eq!(
        env.titles(Some(&env.member)).await,
        ["groups", "public", "users"]
    );
    assert_eq!(
        env.titles(Some(&env.admin)).await,
        ["draft", "groups", "public", "scheduled", "users"]
    );
}

#[sqlx::test]
async fn test_hidden_items_are_not_found(pool: PgPool) {
    let env = setup(pool).await;
    let [public, users, groups, draft, scheduled] = create_all_kinds(&env).await;

    let get = |id: Uuid, auth: Option<String>| {
        let app = env.app.clone();
        async move {
            request(&app, "GET", &format!("/news/{id}"), auth.as_deref(), None)
                .await
                .0
        }
    };

    assert_eq!(get(public, None).await, StatusCode::OK);
    assert_eq!(get(users, None).await, StatusCode::NOT_FOUND);
    assert_eq!(
        get(groups, Some(env.other.clone())).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(get(groups, Some(env.member.clone())).await, StatusCode::OK);
    assert_eq!(
        get(draft, Some(env.member.clone())).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(scheduled, Some(env.member.clone())).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(get(draft, Some(env.admin.clone())).await, StatusCode::OK);

    // Marking a hidden item read is refused the same way
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/news/{groups}/read"),
        Some(&env.other),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn test_group_ids_only_returned_to_admins(pool: PgPool) {
    let env = setup(pool).await;
    let id = env
        .create(
            "groups",
            json!({"visibility": "groups", "visible_group_ids": [env.group]}),
        )
        .await;

    let (_, item) = request(
        &env.app,
        "GET",
        &format!("/news/{id}"),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(item["visible_group_ids"], json!([env.group]));

    let (_, item) = request(
        &env.app,
        "GET",
        &format!("/news/{id}"),
        Some(&env.member),
        None,
    )
    .await;
    assert_eq!(item["visible_group_ids"], json!([]));
}

#[sqlx::test]
async fn test_read_tracking(pool: PgPool) {
    let env = setup(pool).await;
    let [public, ..] = create_all_kinds(&env).await;

    // public + users + groups; draft and scheduled don't count
    assert_eq!(env.unread(&env.member).await, 3);
    assert_eq!(env.unread(&env.other).await, 2);
    assert_eq!(env.unread(&env.admin).await, 3);

    let (_, list) = request(&env.app, "GET", "/news", None, None).await;
    assert_eq!(list[0]["is_read"], Value::Null, "guests have no read state");

    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/news/{public}/read"),
        Some(&env.member),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(env.unread(&env.member).await, 2);
    assert_eq!(env.unread(&env.other).await, 2, "read state is per user");

    let (_, item) = request(
        &env.app,
        "GET",
        &format!("/news/{public}"),
        Some(&env.member),
        None,
    )
    .await;
    assert_eq!(item["is_read"], true);

    // Marking twice is fine
    let (status, _) = request(
        &env.app,
        "POST",
        &format!("/news/{public}/read"),
        Some(&env.member),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _) = request(&env.app, "POST", "/news/read-all", Some(&env.member), None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(env.unread(&env.member).await, 0);

    let (status, _) = request(&env.app, "GET", "/news/unread-count", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_read_all_skips_unpublished_items(pool: PgPool) {
    let env = setup(pool).await;
    let [.., scheduled] = create_all_kinds(&env).await;

    request(&env.app, "POST", "/news/read-all", Some(&env.admin), None).await;
    assert_eq!(env.unread(&env.admin).await, 0);

    // Once the scheduled item goes out it is unread, even for an admin who saw it as a draft
    sqlx::query!(
        "UPDATE news SET published_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
        scheduled
    )
    .execute(&env.pool)
    .await
    .unwrap();
    assert_eq!(env.unread(&env.admin).await, 1);
}

#[sqlx::test]
async fn test_items_older_than_account_count_as_read(pool: PgPool) {
    let env = setup(pool).await;
    env.create("old", json!({})).await;
    assert_eq!(env.unread(&env.member).await, 1);

    sqlx::query!(
        "UPDATE users SET created_at = NOW() WHERE id = $1",
        env.member_id
    )
    .execute(&env.pool)
    .await
    .unwrap();

    assert_eq!(env.unread(&env.member).await, 0);
    let (_, list) = request(&env.app, "GET", "/news", Some(&env.member), None).await;
    assert_eq!(list[0]["is_read"], true);
}

#[sqlx::test]
async fn test_highlights(pool: PgPool) {
    let env = setup(pool).await;
    let current = env
        .create(
            "current",
            json!({"highlighted": true, "highlight_until": Utc::now() + Duration::days(3)}),
        )
        .await;
    env.create(
        "expired",
        json!({"highlighted": true, "highlight_until": Utc::now() - Duration::hours(1)}),
    )
    .await;
    env.create(
        "members",
        json!({"highlighted": true, "visibility": "users"}),
    )
    .await;
    env.create("plain", json!({})).await;
    env.create("draft", json!({"highlighted": true, "published_at": null}))
        .await;

    let titles = |list: Value| -> Vec<String> {
        let mut titles: Vec<String> = list
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["title"]["fi"].as_str().unwrap().to_string())
            .collect();
        titles.sort();
        titles
    };

    let (_, list) = request(&env.app, "GET", "/news/highlights", None, None).await;
    assert_eq!(titles(list), ["current"]);

    let (_, list) = request(&env.app, "GET", "/news/highlights", Some(&env.member), None).await;
    assert_eq!(titles(list), ["current", "members"]);

    // Read highlights drop off for that user
    request(
        &env.app,
        "POST",
        &format!("/news/{current}/read"),
        Some(&env.member),
        None,
    )
    .await;
    let (_, list) = request(&env.app, "GET", "/news/highlights", Some(&env.member), None).await;
    assert_eq!(titles(list), ["members"]);
}

#[sqlx::test]
async fn test_admin_writes(pool: PgPool) {
    let env = setup(pool).await;
    let body = json!({"title": {"fi": "Uutinen"}, "visibility": "public"});

    let (status, _) = request(
        &env.app,
        "POST",
        "/news",
        Some(&env.member),
        Some(body.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = request(
        &env.app,
        "POST",
        "/news",
        Some(&env.admin),
        Some(json!({"title": {"fi": " "}, "visibility": "public"})),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);

    let (status, _) = request(
        &env.app,
        "POST",
        "/news",
        Some(&env.admin),
        Some(json!({"title": {"fi": "Ryhmille"}, "visibility": "groups"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "groups need a group"
    );

    let (status, _) = request(
        &env.app,
        "POST",
        "/news",
        Some(&env.admin),
        Some(json!({"title": {"fi": "Ryhmille"}, "visibility": "groups", "visible_group_ids": [Uuid::new_v4()]})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "unknown group");

    // Create as a group item, then replace it with a public one
    let id = env
        .create(
            "groups",
            json!({"visibility": "groups", "visible_group_ids": [env.group]}),
        )
        .await;
    let (status, item) = request(
        &env.app,
        "PUT",
        &format!("/news/{id}"),
        Some(&env.admin),
        Some(json!({
            "title": {"fi": "  Kaikille  ", "en": "For everyone"},
            "visibility": "public",
            "visible_group_ids": [env.group],
            "published_at": Utc::now() - Duration::hours(1),
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{item}");
    assert_eq!(
        item["title"],
        json!({"fi": "Kaikille", "en": "For everyone"})
    );
    assert_eq!(item["visible_group_ids"], json!([]));
    assert_eq!(item["blurb"], json!({}));

    let (status, _) = request(&env.app, "GET", &format!("/news/{id}"), None, None).await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = request(
        &env.app,
        "DELETE",
        &format!("/news/{id}"),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = request(
        &env.app,
        "GET",
        &format!("/news/{id}"),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = request(
        &env.app,
        "DELETE",
        &format!("/news/{id}"),
        Some(&env.admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
