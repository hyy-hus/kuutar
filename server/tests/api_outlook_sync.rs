mod common;

use std::sync::Mutex;

use async_trait::async_trait;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use common::{setup_user_token, test_config};
use kuutar::{
    app,
    config::Config,
    domains::{
        outlook_sync::{
            graph::{GraphClient, GraphError, InboxMessage, OutlookClient},
            poller,
        },
        users::models::Role,
    },
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{method, path, path_regex},
};

#[derive(Default)]
struct FakeMailbox {
    messages: Mutex<Vec<(InboxMessage, Vec<String>)>>,
    processed: Mutex<Vec<String>>,
}

impl FakeMailbox {
    fn with(messages: Vec<(&str, Vec<String>)>) -> Self {
        Self {
            messages: Mutex::new(
                messages
                    .into_iter()
                    .map(|(id, ics)| {
                        (
                            InboxMessage {
                                id: id.to_string(),
                                subject: Some(format!("Invite {id}")),
                                received_at: None,
                            },
                            ics,
                        )
                    })
                    .collect(),
            ),
            processed: Mutex::default(),
        }
    }
}

#[async_trait]
impl OutlookClient for FakeMailbox {
    async fn list_unread(&self) -> Result<Vec<InboxMessage>, GraphError> {
        let processed = self.processed.lock().unwrap();
        Ok(self
            .messages
            .lock()
            .unwrap()
            .iter()
            .filter(|(m, _)| !processed.contains(&m.id))
            .map(|(m, _)| m.clone())
            .collect())
    }

    async fn calendar_attachments(&self, message_id: &str) -> Result<Vec<String>, GraphError> {
        Ok(self
            .messages
            .lock()
            .unwrap()
            .iter()
            .find(|(m, _)| m.id == message_id)
            .map(|(_, ics)| ics.clone())
            .unwrap_or_default())
    }

    async fn mark_processed(&self, message_id: &str) -> Result<(), GraphError> {
        self.processed.lock().unwrap().push(message_id.to_string());
        Ok(())
    }
}

fn ics(method_name: &str, uid: &str, sequence: i32, start: &str, end: &str, room: &str) -> String {
    format!(
        "BEGIN:VCALENDAR\r\nMETHOD:{method_name}\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n\
         UID:{uid}\r\nSEQUENCE:{sequence}\r\nSUMMARY:Sauna evening\r\n\
         DTSTART;TZID=FLE Standard Time:{start}\r\nDTEND;TZID=FLE Standard Time:{end}\r\n\
         ORGANIZER;CN=Olli Organizer:mailto:olli@example.com\r\n\
         ATTENDEE;CUTYPE=RESOURCE:mailto:{room}\r\n\
         END:VEVENT\r\nEND:VCALENDAR\r\n"
    )
}

async fn create_resource(pool: &PgPool, name: &str, outlook_email: Option<&str>) -> Uuid {
    let collection_id = sqlx::query_scalar!(
        "INSERT INTO collections (name) VALUES ($1) RETURNING id",
        format!("Collection {}", Uuid::new_v4())
    )
    .fetch_one(pool)
    .await
    .unwrap();
    sqlx::query_scalar!(
        "INSERT INTO resources (collection_id, name, outlook_email) VALUES ($1, $2, $3) RETURNING id",
        collection_id,
        name,
        outlook_email
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn reservation_state(pool: &PgPool, uid: &str) -> (String, Vec<(Uuid, String)>) {
    let row = sqlx::query!(
        "SELECT id, status::text AS \"status!\" FROM reservations WHERE ical_uid = $1",
        uid
    )
    .fetch_one(pool)
    .await
    .unwrap();
    let occurrences = sqlx::query!(
        "SELECT resource_id, start_time FROM occurrences WHERE reservation_id = $1 ORDER BY start_time",
        row.id
    )
    .fetch_all(pool)
    .await
    .unwrap()
    .into_iter()
    .map(|o| (o.resource_id, o.start_time.to_rfc3339()))
    .collect();
    (row.status, occurrences)
}

async fn request(
    app: &Router,
    method: &str,
    uri: &str,
    auth: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, auth);
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

#[sqlx::test]
async fn invite_becomes_confirmed_reservation_and_follows_updates(pool: PgPool) {
    let (_admin, admin_id, _) = setup_user_token(&pool, Role::Admin).await;
    let sauna = create_resource(&pool, "Sauna", Some("sauna@hyy.fi")).await;
    let config = test_config();

    // Imported, even though another confirmed reservation already holds the slot
    let blocker = sqlx::query_scalar!(
        "INSERT INTO reservations (user_id, title, status) VALUES ($1, 'Blocker', 'confirmed') RETURNING id",
        admin_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    sqlx::query!(
        "INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time)
         VALUES ($1, $2, '2030-01-15T16:00:00Z', '2030-01-15T19:00:00Z')",
        blocker,
        sauna
    )
    .execute(&pool)
    .await
    .unwrap();

    let mailbox = FakeMailbox::with(vec![(
        "m1",
        vec![ics(
            "REQUEST",
            "uid-1",
            0,
            "20300115T180000",
            "20300115T200000",
            "Sauna@HYY.fi",
        )],
    )]);
    let report = poller::process_inbox(&pool, &config, &mailbox)
        .await
        .unwrap();
    assert_eq!((report.messages, report.imported), (1, 1));

    // 18:00 Helsinki (winter) is 16:00 UTC
    let (status, occ) = reservation_state(&pool, "uid-1").await;
    assert_eq!(status, "confirmed");
    assert_eq!(occ, vec![(sauna, "2030-01-15T16:00:00+00:00".to_string())]);
    let (source, owner_contact) =
        sqlx::query!("SELECT source, contact_email FROM reservations WHERE ical_uid = 'uid-1'")
            .fetch_one(&pool)
            .await
            .map(|r| (r.source, r.contact_email))
            .unwrap();
    assert_eq!(source, "outlook");
    assert_eq!(owner_contact.as_deref(), Some("olli@example.com"));

    // The processed message is not picked up again
    let again = poller::process_inbox(&pool, &config, &mailbox)
        .await
        .unwrap();
    assert_eq!(again.messages, 0);

    // A stale (same sequence) resend is ignored, a newer one moves the event
    let mailbox = FakeMailbox::with(vec![
        (
            "m2",
            vec![ics(
                "REQUEST",
                "uid-1",
                0,
                "20300116T100000",
                "20300116T110000",
                "sauna@hyy.fi",
            )],
        ),
        (
            "m3",
            vec![ics(
                "REQUEST",
                "uid-1",
                1,
                "20300116T100000",
                "20300116T110000",
                "sauna@hyy.fi",
            )],
        ),
    ]);
    let report = poller::process_inbox(&pool, &config, &mailbox)
        .await
        .unwrap();
    assert_eq!((report.ignored, report.updated), (1, 1));
    let (_, occ) = reservation_state(&pool, "uid-1").await;
    assert_eq!(occ, vec![(sauna, "2030-01-16T08:00:00+00:00".to_string())]);

    // Cancellation
    let mailbox = FakeMailbox::with(vec![(
        "m4",
        vec![ics(
            "CANCEL",
            "uid-1",
            2,
            "20300116T100000",
            "20300116T110000",
            "sauna@hyy.fi",
        )],
    )]);
    let report = poller::process_inbox(&pool, &config, &mailbox)
        .await
        .unwrap();
    assert_eq!(report.cancelled, 1);
    assert_eq!(reservation_state(&pool, "uid-1").await.0, "cancelled");

    let logged = sqlx::query_scalar!("SELECT COUNT(*) FROM outlook_sync_log")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(logged, Some(4));
}

#[sqlx::test]
async fn invites_without_a_matching_resource_are_ignored(pool: PgPool) {
    setup_user_token(&pool, Role::Admin).await;
    create_resource(&pool, "Sauna", Some("sauna@hyy.fi")).await;

    let mailbox = FakeMailbox::with(vec![
        (
            "m1",
            vec![ics(
                "REQUEST",
                "uid-9",
                0,
                "20300115T180000",
                "20300115T200000",
                "other@hyy.fi",
            )],
        ),
        ("m2", vec!["garbage".to_string()]),
        ("m3", vec![]),
    ]);
    let report = poller::process_inbox(&pool, &test_config(), &mailbox)
        .await
        .unwrap();
    assert_eq!((report.messages, report.ignored, report.errors), (3, 3, 0));

    let reservations = sqlx::query_scalar!("SELECT COUNT(*) FROM reservations")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(reservations, Some(0));
}

#[sqlx::test]
async fn outlook_reservations_cannot_be_edited_or_deleted_in_kuutar(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    create_resource(&pool, "Sauna", Some("sauna@hyy.fi")).await;
    let mailbox = FakeMailbox::with(vec![(
        "m1",
        vec![ics(
            "REQUEST",
            "uid-2",
            0,
            "20300115T180000",
            "20300115T200000",
            "sauna@hyy.fi",
        )],
    )]);
    poller::process_inbox(&pool, &test_config(), &mailbox)
        .await
        .unwrap();
    let id = sqlx::query_scalar!("SELECT id FROM reservations WHERE ical_uid = 'uid-2'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let app = app(pool, test_config());

    let (status, _) = request(
        &app,
        "PATCH",
        &format!("/reservations/{id}"),
        &admin,
        Some(json!({ "title": "Renamed" })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, _) = request(&app, "DELETE", &format!("/reservations/{id}"), &admin, None).await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, body) = request(
        &app,
        "PATCH",
        &format!("/reservations/{id}"),
        &admin,
        Some(json!({ "admin_notes": "Key at the desk" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["source"], "outlook");
}

#[sqlx::test]
async fn admin_sets_resource_outlook_email(pool: PgPool) {
    let (admin, _, _) = setup_user_token(&pool, Role::Admin).await;
    let (user, _, _) = setup_user_token(&pool, Role::User).await;
    let resource = create_resource(&pool, "Sauna", None).await;
    let app = app(pool, test_config());

    let (status, body) = request(
        &app,
        "PATCH",
        &format!("/resources/{resource}"),
        &admin,
        Some(json!({ "outlook_email": " Sauna@HYY.fi " })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["outlook_email"], "sauna@hyy.fi");

    // Hidden from non-admins
    let (_, body) = request(&app, "GET", &format!("/resources/{resource}"), &user, None).await;
    assert!(body.get("outlook_email").is_none());

    let (status, _) = request(
        &app,
        "PATCH",
        &format!("/resources/{resource}"),
        &admin,
        Some(json!({ "outlook_email": "not an address" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);

    let (_, body) = request(
        &app,
        "PATCH",
        &format!("/resources/{resource}"),
        &admin,
        Some(json!({ "outlook_email": "" })),
    )
    .await;
    assert!(body.get("outlook_email").is_none());
}

fn graph_config(server: &MockServer) -> Config {
    Config {
        graph_tenant_id: Some("tenant".to_string()),
        graph_client_id: Some("client".to_string()),
        graph_client_secret: Some("secret".to_string()),
        graph_intake_mailbox: Some("kalenteri@hyy.fi".to_string()),
        graph_base_url: format!("{}/v1.0", server.uri()),
        graph_login_url: server.uri(),
        ..test_config()
    }
}

#[tokio::test]
async fn graph_client_talks_to_microsoft_graph() {
    use base64::{Engine, engine::general_purpose::STANDARD};

    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/tenant/oauth2/v2.0/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            json!({ "access_token": "tok", "expires_in": 3600, "token_type": "Bearer" }),
        ))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path(
            "/v1.0/users/kalenteri@hyy.fi/mailFolders/inbox/messages",
        ))
        .and(wiremock::matchers::header("authorization", "Bearer tok"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "value": [
            { "id": "late", "subject": "B", "receivedDateTime": "2030-01-02T10:00:00Z" },
            { "id": "early", "subject": "A", "receivedDateTime": "2030-01-01T10:00:00Z" },
        ]})))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1.0/users/kalenteri@hyy.fi/messages/early/attachments"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "value": [
            { "name": "logo.png", "contentType": "image/png", "contentBytes": STANDARD.encode("png") },
            { "name": "invite.ics", "contentType": "text/calendar", "contentBytes": STANDARD.encode("BEGIN:VCALENDAR") },
        ]})))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path_regex(r"/messages/early/move$"))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({})))
        .expect(1)
        .mount(&server)
        .await;

    let client = GraphClient::from_config(&graph_config(&server)).unwrap();

    let messages = client.list_unread().await.unwrap();
    assert_eq!(
        messages.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
        ["early", "late"]
    );
    assert_eq!(
        client.calendar_attachments("early").await.unwrap(),
        vec!["BEGIN:VCALENDAR".to_string()]
    );
    client.mark_processed("early").await.unwrap();
}

#[tokio::test]
async fn graph_client_reports_failed_requests() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/tenant/oauth2/v2.0/token"))
        .respond_with(ResponseTemplate::new(401))
        .mount(&server)
        .await;
    let client = GraphClient::from_config(&graph_config(&server)).unwrap();
    assert!(client.list_unread().await.is_err());
}
