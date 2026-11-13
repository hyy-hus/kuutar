//! Synthetic mock data for dev, e2e and screenshots.
//!
//! Everything here is fictional. Seeded users all use `@example.test` addresses, and every
//! group / collection / round / restriction / block / contract has a fixed name listed in
//! this file, so [`reset`] can remove exactly what the seeder created and nothing else.

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Europe::Helsinki;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub const MOCK_DOMAIN: &str = "example.test";
pub const ADMIN_EMAIL: &str = "admin@example.test";
pub const USER_EMAIL: &str = "user@example.test";

const GROUPS: &[&str] = &[
    "Hallinto (Admin Office)",
    "Kuutamo ry",
    "Revontuli ry",
    "Pohjantähti ry",
    "Myrsky ry",
    "Kielo ry",
    "Tuulikello ry",
    "Norrsken rf",
    "Lumikello ry",
    "Mosaic Society",
    "Polar Lights Club",
    "Henkilökunta (Staff)",
    "Ulkopuoliset (External)",
];

const COLLECTIONS: &[&str] = &[
    "Juhlatilat",
    "Kokoustilat",
    "Luentosalit",
    "Tekniikka",
    "Kalusto",
    "Sisäiset tilat",
];

const ROUNDS: &[&str] = &[
    "Syyslukukauden varausvuoro",
    "Kevätlukukauden varausvuoro",
    "Kesän varausvuoro",
];

const RESTRICTIONS: &[&str] = &["Joulusulku", "Salin 101 remontti"];
const BLOCKS: &[&str] = &["Salin 101 opetusajat"];
const CONTRACTS: &[&str] = &[
    "Yleiset käyttöehdot",
    "Juhlatilojen sopimus",
    "Vanha sopimus",
];

/// News titles (fi, sv, en). The Finnish title identifies seeded items for [`reset`].
const NEWS: &[(&str, &str, &str)] = &[
    (
        "Joulun aukioloajat",
        "Öppettider under julen",
        "Opening hours over Christmas",
    ),
    (
        "Kevään varauskierros avautuu",
        "Vårens bokningsomgång öppnar",
        "Spring reservation round opens",
    ),
    (
        "Kristallisalin remontti",
        "Renovering av Kristallsalen",
        "Kristallisali renovation",
    ),
    (
        "Kameroiden lainausohjeet päivitetty",
        "Nya anvisningar för kameralån",
        "Camera loan instructions updated",
    ),
    (
        "Kokoustilat järjestöille",
        "Mötesrum för föreningar",
        "Meeting rooms for organisations",
    ),
    (
        "Henkilökunnan tiedote",
        "Meddelande till personalen",
        "Notice to staff",
    ),
    (
        "Kirjautuminen sähköpostikoodilla",
        "Inloggning med e-postkod",
        "Signing in with an email code",
    ),
    (
        "Grillin käyttöohjeet",
        "Anvisningar för grillen",
        "How to use the grill",
    ),
    (
        "Peruutusehdot tarkentuvat",
        "Förtydligade avbokningsvillkor",
        "Clearer cancellation terms",
    ),
    (
        "Tervetuloa käyttämään varausjärjestelmää",
        "Välkommen till bokningssystemet",
        "Welcome to the booking system",
    ),
    (
        "Kesän aukioloajat",
        "Öppettider under sommaren",
        "Summer opening hours",
    ),
    (
        "Joulutauon varaukset",
        "Bokningar under jullovet",
        "Reservations over the holiday break",
    ),
];

const FIRST: &[&str] = &[
    "Aino", "Eemeli", "Siiri", "Oskar", "Helmi", "Veeti", "Aada", "Leo", "Ella", "Elias", "Venla",
    "Onni", "Emma", "Matias", "Ilona", "Niklas", "Linnea", "Aleksi", "Sofia", "Juho", "Alma",
    "Otto", "Nella", "Anton", "Pihla", "Viktor", "Saga", "Kasper", "Ida", "Rasmus", "Maja",
    "Johan", "Elsa", "Gustav", "Hilda", "Alva", "Noah", "Mia", "Lucas", "Olivia", "Emil", "Freja",
    "Tuomas", "Reetta", "Joonas", "Minna", "Antti", "Satu", "Petri", "Heidi", "Mikko", "Kaisa",
    "Ville", "Tiina", "Henrik", "Karin", "Samuel", "Nora", "Daniel", "Lotta",
];

const LAST: &[&str] = &[
    "Virtanen",
    "Korhonen",
    "Mäkelä",
    "Nieminen",
    "Hämäläinen",
    "Laine",
    "Heikkinen",
    "Koskinen",
    "Järvinen",
    "Lehtonen",
    "Saarinen",
    "Salminen",
    "Heinonen",
    "Niemi",
    "Kinnunen",
    "Turunen",
    "Salonen",
    "Rantanen",
    "Karjalainen",
    "Hiltunen",
    "Mattsson",
    "Lindqvist",
    "Eriksson",
    "Holm",
    "Lundberg",
    "Berg",
    "Nyman",
    "Wikström",
    "Sjöberg",
    "Ahlström",
    "Smith",
    "Taylor",
    "Brown",
    "Wilson",
    "Clark",
    "Walker",
    "Hall",
    "Young",
    "King",
    "Wright",
    "Aaltonen",
    "Ojala",
    "Kauppinen",
    "Rinne",
    "Vainio",
    "Peltola",
    "Suominen",
    "Räsänen",
    "Tikkanen",
    "Honkanen",
    "Kallio",
    "Lahtinen",
    "Mustonen",
    "Sirola",
    "Tuomi",
    "Halonen",
    "Pitkänen",
];

const TITLES: &[&str] = &[
    "Hallituksen kokous",
    "Sitsit",
    "Vuosijuhla",
    "Koulutus",
    "Kuoroharjoitus",
    "Elokuvailta",
    "Yleiskokous",
    "Työryhmän tapaaminen",
    "Pelituloilta",
    "Syysjuhla",
    "Workshop",
    "Board meeting",
    "Alumni evening",
    "Lautapeli-ilta",
    "Hackathon",
    "Kielikahvila",
    "Fuksiaiset",
    "Näytelmäharjoitus",
    "Valokuvakurssi",
    "Quiz night",
    "Toimikunnan kokous",
    "Jäsenilta",
    "Seminaari",
    "Tuutorikoulutus",
    "Pikkujoulut",
    "Vappukokous",
    "Bandikeikka",
    "Opintopiiri",
    "Ruotsinkurssi",
    "Talousryhmä",
];

const LONG_TITLE: &str = "Kansainvälisten opiskelijoiden ja yhteistyökumppanien vuosittainen \
    kauden päätösjuhla sekä palkintojenjako – erittäin pitkä otsikko rivityksen testaamiseen 🎉";

const CANCEL_REASONS: &[&str] = &[
    "Tapahtuma peruttu osallistujapulan vuoksi.",
    "Siirretään toiseen tilaan.",
    "Päällekkäinen varaus löytyi.",
    "Cancelled by the organiser.",
];

const DESCRIPTIONS: &[&str] = &[
    "Noin 30 osallistujaa. Tarvitsemme projektorin ja kahvitarjoilun.",
    "Kokous, jossa käsitellään syksyn budjettia.",
    "Open to all members. Please bring your own snacks.",
    "Pystytys alkaa tuntia aiemmin.",
    "Äänentoisto tarvitaan, bändi soittaa 20.00 alkaen.",
];

// ---------------------------------------------------------------------------------------------
// Options and RNG
// ---------------------------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Size {
    Small,
    Prod,
}

pub struct MockOptions {
    pub seed: u64,
    pub size: Size,
    /// "Today" for the dataset. Dates are generated relative to this day.
    pub anchor: NaiveDate,
    /// Argon2 hash of the shared dev password used by every mock user.
    pub password_hash: String,
}

#[derive(Debug, Default)]
pub struct Summary {
    pub groups: usize,
    pub users: usize,
    pub resources: usize,
    pub reservations: usize,
    pub occurrences: usize,
    pub rounds: usize,
    pub news: usize,
}

/// SplitMix64. Small, deterministic and independent of the `rand` crate's API.
struct Rng(u64);

impl Rng {
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
    /// Uniform in `[lo, hi)`.
    fn range(&mut self, lo: i64, hi: i64) -> i64 {
        lo + (self.next() % (hi - lo) as u64) as i64
    }
    fn chance(&mut self, pct: u64) -> bool {
        self.next() % 100 < pct
    }
    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len())]
    }
}

// ---------------------------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------------------------

type Dt = DateTime<Utc>;

fn hel(d: NaiveDate, h: u32, m: u32) -> Dt {
    let naive = d.and_hms_opt(h, m, 0).expect("valid time");
    Helsinki
        .from_local_datetime(&naive)
        .earliest()
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&naive))
}

fn add_months(d: NaiveDate, n: u32) -> NaiveDate {
    d.checked_add_months(chrono::Months::new(n))
        .expect("date in range")
}

fn rrule_string(d: NaiveDate, h: u32, m: u32, interval: i64, count: i64) -> String {
    format!(
        "DTSTART;TZID=Europe/Helsinki:{}T{:02}{:02}00\nRRULE:FREQ=WEEKLY;INTERVAL={};COUNT={}",
        d.format("%Y%m%d"),
        h,
        m,
        interval,
        count
    )
}

fn overlaps(busy: &[(Dt, Dt)], s: Dt, e: Dt) -> bool {
    busy.iter().any(|&(bs, be)| bs < e && be > s)
}

fn fold(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'ä' | 'å' => 'a',
            'ö' => 'o',
            'é' => 'e',
            _ => c,
        })
        .collect()
}

fn doc(text: &str) -> Value {
    json!({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]})
}

fn i18n_doc(text: &str) -> Value {
    json!({ "fi": doc(text) })
}

// ---------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------

struct UserRec {
    id: Uuid,
    group_id: Uuid,
    admin: bool,
    contact: Option<(String, String, String)>,
}

struct ResRec {
    id: Uuid,
    collection: usize,
    allow_recurring: bool,
    blocks_only: bool,
    /// Non-empty means only these groups may reserve (or even see) the resource.
    allowed_groups: Vec<Uuid>,
    auto_confirm: bool,
    min_minutes: Option<i64>,
    max_minutes: Option<i64>,
    default_minutes: Option<i64>,
    reservable_until: Option<Dt>,
    contract: Option<Uuid>,
}

struct NewResv {
    user_id: Uuid,
    title: String,
    description: Option<String>,
    description_rich: Option<Value>,
    rrule: Option<String>,
    status: &'static str,
    admin_notes: Option<String>,
    message_to_admins: Option<String>,
    contact: Option<(String, String, String)>,
    contract_id: Option<Uuid>,
    cancelled: Option<(Dt, Uuid, String)>,
    source: &'static str,
    ical_uid: Option<String>,
    round: Option<(Uuid, i32)>,
    created_at: Dt,
    occurrences: Vec<(Uuid, Dt, Dt)>,
}

impl NewResv {
    fn simple(user_id: Uuid, title: String, status: &'static str, created_at: Dt) -> Self {
        Self {
            user_id,
            title,
            description: None,
            description_rich: None,
            rrule: None,
            status,
            admin_notes: None,
            message_to_admins: None,
            contact: None,
            contract_id: None,
            cancelled: None,
            source: "kuutar",
            ical_uid: None,
            round: None,
            created_at,
            occurrences: vec![],
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------------------------

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

/// Removes exactly the rows the seeder creates (identified by `@example.test` emails and the
/// fixed names above). Rows from anywhere else are never touched.
pub async fn reset(pool: &PgPool) -> Result<()> {
    let mut tx = pool.begin().await?;
    let like = format!("%@{MOCK_DOMAIN}");
    let steps: Vec<(&str, Vec<String>)> = vec![
        (
            "DELETE FROM reservations WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)",
            vec![like.clone()],
        ),
        (
            "DELETE FROM outlook_sync_log WHERE graph_message_id LIKE 'mock-%'",
            vec![],
        ),
    ];
    for (sql, binds) in steps {
        let mut q = sqlx::query(sql);
        for b in &binds {
            q = q.bind(b);
        }
        q.execute(&mut *tx).await?;
    }
    let news_titles: Vec<String> = NEWS.iter().map(|(fi, _, _)| fi.to_string()).collect();
    sqlx::query("DELETE FROM news WHERE title->>'fi' = ANY($1)")
        .bind(news_titles)
        .execute(&mut *tx)
        .await?;
    let by_names: &[(&str, &[&str])] = &[
        (
            "DELETE FROM reservation_rounds WHERE name = ANY($1)",
            ROUNDS,
        ),
        (
            "DELETE FROM restrictions WHERE title = ANY($1)",
            RESTRICTIONS,
        ),
        (
            "DELETE FROM reservable_blocks WHERE title = ANY($1)",
            BLOCKS,
        ),
        (
            "DELETE FROM contracts WHERE title->>'fi' = ANY($1)",
            CONTRACTS,
        ),
        ("DELETE FROM collections WHERE name = ANY($1)", COLLECTIONS),
    ];
    for (sql, list) in by_names {
        sqlx::query(*sql)
            .bind(names(list))
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("DELETE FROM users WHERE email LIKE $1")
        .bind(&like)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM groups WHERE name = ANY($1)")
        .bind(names(GROUPS))
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------------------------

pub async fn seed(pool: &PgPool, opts: &MockOptions) -> Result<Summary> {
    let already: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email LIKE $1)")
            .bind(format!("%@{MOCK_DOMAIN}"))
            .fetch_one(pool)
            .await?;
    if already {
        bail!("Mock data already present. Re-run with --reset to replace it.");
    }

    let mut rng = Rng(opts.seed);
    let mut tx = pool.begin().await?;
    let mut summary = Summary::default();
    let prod = opts.size == Size::Prod;

    let month_start = opts.anchor.with_day(1).expect("first of month");
    let now = hel(opts.anchor, 12, 0);

    // --- Groups ---------------------------------------------------------------------------
    let mut group_ids = vec![];
    for (i, name) in GROUPS.iter().enumerate() {
        let desc = (i % 3 == 0).then(|| i18n_doc("Esimerkkiryhmä testidataa varten."));
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id",
        )
        .bind(name)
        .bind(desc)
        .fetch_one(&mut *tx)
        .await?;
        group_ids.push(id);
    }
    summary.groups = group_ids.len();
    let admin_group = group_ids[0];
    let staff_group = group_ids[11];
    let external_group = group_ids[12];
    // Regular groups that book the most.
    let org_groups = &group_ids[1..11];

    // --- Users ----------------------------------------------------------------------------
    let user_total = if prod { 235 } else { 24 };
    let mut users: Vec<UserRec> = vec![];
    let mut seen = std::collections::HashSet::new();
    for i in 0..user_total {
        let (name, email, admin, group_id) = match i {
            0 => (
                "Dev Admin".to_string(),
                ADMIN_EMAIL.to_string(),
                true,
                admin_group,
            ),
            1 => (
                "Dev User".to_string(),
                USER_EMAIL.to_string(),
                false,
                org_groups[0],
            ),
            2 | 3 => {
                let n = format!("{} {}", rng.pick(FIRST), rng.pick(LAST));
                (n, format!("staff{i}@{MOCK_DOMAIN}"), true, admin_group)
            }
            _ => {
                let (f, l) = (*rng.pick(FIRST), *rng.pick(LAST));
                let mut email = format!("{}.{}@{MOCK_DOMAIN}", fold(f), fold(l));
                if !seen.insert(email.clone()) {
                    email = format!("{}.{}{i}@{MOCK_DOMAIN}", fold(f), fold(l));
                    seen.insert(email.clone());
                }
                let g = match rng.below(20) {
                    0 => staff_group,
                    1 => external_group,
                    _ => *rng.pick(org_groups),
                };
                (format!("{f} {l}"), email, false, g)
            }
        };
        seen.insert(email.clone());
        let language = match rng.below(100) {
            0..=69 => "fi",
            70..=81 => "sv",
            _ => "en",
        };
        let contact = rng.chance(60).then(|| {
            (
                name.clone(),
                email.clone(),
                format!("+358 40 555 {:04}", rng.below(10_000)),
            )
        });
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (group_id, email, password_hash, role, name, default_contact_person, \
             default_contact_email, default_contact_phone, language, created_at) \
             VALUES ($1, $2, $3, $4::text::user_role, $5, $6, $7, $8, $9, $10) RETURNING id",
        )
        .bind(group_id)
        .bind(&email)
        .bind(&opts.password_hash)
        .bind(if admin { "admin" } else { "user" })
        .bind(&name)
        .bind(contact.as_ref().map(|c| c.0.clone()))
        .bind(contact.as_ref().map(|c| c.1.clone()))
        .bind(contact.as_ref().map(|c| c.2.clone()))
        .bind(language)
        // Accounts predate the seeded news, so news counts as unread for them
        .bind(now - Duration::days(400 - i as i64 % 300))
        .fetch_one(&mut *tx)
        .await?;
        users.push(UserRec {
            id,
            group_id,
            admin,
            contact,
        });
    }
    summary.users = users.len();
    let admin_id = users[0].id;

    // --- Collections ----------------------------------------------------------------------
    let collection_icons = ["party", "meeting", "lecture", "projector", "truck", "lab"];
    let mut collection_ids = vec![];
    for (i, name) in COLLECTIONS.iter().enumerate() {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO collections (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        )
        .bind(name)
        .bind(
            (i % 2 == 0)
                .then(|| i18n_doc("Kokoelman kuvaus: vuokrattavat kohteet ja käyttöohjeet.")),
        )
        .bind(collection_icons[i])
        .fetch_one(&mut *tx)
        .await?;
        collection_ids.push(id);
    }

    // --- Contracts ------------------------------------------------------------------------
    let mut contract_ids = vec![];
    for (i, title) in CONTRACTS.iter().enumerate() {
        // The PDFs do not exist in S3: the keys are placeholders.
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO contracts (title, s3_key, file_name, is_global, is_active) \
             VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(json!({"fi": title, "en": format!("Mock contract {i}")}))
        .bind(
            json!({"fi": format!("mock/sopimus-{i}.pdf"), "en": format!("mock/contract-{i}.pdf")}),
        )
        .bind(json!({"fi": format!("sopimus-{i}.pdf"), "en": format!("contract-{i}.pdf")}))
        .bind(i == 0)
        .bind(i != 2)
        .fetch_one(&mut *tx)
        .await?;
        contract_ids.push(id);
    }

    // --- Resources ------------------------------------------------------------------------
    // (collection, name, color, flags)
    #[derive(Clone)]
    struct Spec {
        c: usize,
        name: &'static str,
        color: Option<&'static str>,
        recurring: bool,
        public: bool,
        blocks_only: bool,
        restricted: bool,
        visibility: bool,
        auto_confirm: bool,
        durations: Option<(i32, i32, i32)>,
        until_days: Option<i64>,
        outlook: Option<&'static str>,
        party_contract: bool,
    }
    let base = Spec {
        c: 0,
        name: "",
        color: None,
        recurring: true,
        public: true,
        blocks_only: false,
        restricted: false,
        visibility: false,
        auto_confirm: false,
        durations: None,
        until_days: None,
        outlook: None,
        party_contract: false,
    };
    let specs = vec![
        Spec {
            c: 0,
            name: "Kristallisali",
            color: Some("violet"),
            party_contract: true,
            outlook: Some("kristallisali@example.test"),
            ..base_clone(&base)
        },
        Spec {
            c: 0,
            name: "Pieni sali",
            color: Some("pink"),
            restricted: true,
            party_contract: true,
            ..base_clone(&base)
        },
        Spec {
            c: 0,
            name: "Terassi",
            color: Some("#e11d48"),
            recurring: false,
            party_contract: true,
            ..base_clone(&base)
        },
        Spec {
            c: 1,
            name: "Neuvotteluhuone A",
            color: Some("sky"),
            outlook: Some("neuvotteluhuone-a@example.test"),
            ..base_clone(&base)
        },
        Spec {
            c: 1,
            name: "Neuvotteluhuone B",
            color: Some("teal"),
            ..base_clone(&base)
        },
        Spec {
            c: 1,
            name: "Kabinetti",
            color: Some("emerald"),
            auto_confirm: true,
            durations: Some((30, 60, 120)),
            ..base_clone(&base)
        },
        Spec {
            c: 2,
            name: "Sali 101",
            color: Some("blue"),
            blocks_only: true,
            ..base_clone(&base)
        },
        Spec {
            c: 2,
            name: "Sali 102",
            color: Some("lime"),
            ..base_clone(&base)
        },
        Spec {
            c: 2,
            name: "Atrium",
            color: Some("#0ea5e9"),
            visibility: true,
            ..base_clone(&base)
        },
        Spec {
            c: 3,
            name: "Projektori",
            color: Some("amber"),
            recurring: false,
            durations: Some((60, 240, 1440)),
            ..base_clone(&base)
        },
        Spec {
            c: 3,
            name: "Äänentoisto",
            color: Some("orange"),
            restricted: true,
            recurring: false,
            ..base_clone(&base)
        },
        Spec {
            c: 3,
            name: "Kamera",
            color: None,
            auto_confirm: true,
            recurring: false,
            ..base_clone(&base)
        },
        Spec {
            c: 4,
            name: "Pakettiauto",
            color: Some("red"),
            until_days: Some(75),
            durations: Some((120, 240, 2880)),
            recurring: false,
            ..base_clone(&base)
        },
        Spec {
            c: 4,
            name: "Teltta",
            color: Some("#16a34a"),
            recurring: false,
            ..base_clone(&base)
        },
        Spec {
            c: 4,
            name: "Grilli",
            color: Some("orange"),
            recurring: false,
            auto_confirm: true,
            ..base_clone(&base)
        },
        Spec {
            c: 5,
            name: "Sisäinen studio",
            color: Some("violet"),
            public: false,
            visibility: true,
            ..base_clone(&base)
        },
    ];

    let mut resources: Vec<ResRec> = vec![];
    let mut restricted_pool: Vec<Uuid> = org_groups[..3].to_vec();
    restricted_pool.push(admin_group);
    for s in &specs {
        let until = s
            .until_days
            .map(|d| hel(opts.anchor + Duration::days(d), 23, 59));
        let (min, def, max) = match s.durations {
            Some((a, b, c)) => (Some(a), Some(b), Some(c)),
            None => (None, None, None),
        };
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO resources (collection_id, name, description, allow_recurring, is_public, \
             blocks_only, reservation_restricted, auto_confirm, reservable_until, \
             min_duration_minutes, default_duration_minutes, max_duration_minutes, color, outlook_email) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id",
        )
        .bind(collection_ids[s.c])
        .bind(s.name)
        .bind(i18n_doc("Esimerkkikohde. Kapasiteetti ja varusteet kuvataan tässä."))
        .bind(s.recurring)
        .bind(s.public)
        .bind(s.blocks_only)
        .bind(s.restricted)
        .bind(s.auto_confirm)
        .bind(until)
        .bind(min)
        .bind(def)
        .bind(max)
        .bind(s.color)
        .bind(s.outlook)
        .fetch_one(&mut *tx)
        .await?;

        let mut allowed = vec![];
        if s.restricted {
            for g in &restricted_pool {
                sqlx::query("INSERT INTO resource_groups (resource_id, group_id) VALUES ($1,$2)")
                    .bind(id)
                    .bind(g)
                    .execute(&mut *tx)
                    .await?;
            }
            allowed = restricted_pool.clone();
        }
        if s.visibility {
            let vis: Vec<Uuid> = vec![org_groups[1], org_groups[2], org_groups[3], admin_group];
            for g in &vis {
                sqlx::query(
                    "INSERT INTO resource_visibility_groups (resource_id, group_id) VALUES ($1,$2)",
                )
                .bind(id)
                .bind(g)
                .execute(&mut *tx)
                .await?;
            }
            allowed = vis;
        }
        if s.auto_confirm && s.name == "Kabinetti" {
            for g in [org_groups[0], org_groups[1], staff_group] {
                sqlx::query("INSERT INTO resource_auto_confirm_groups (resource_id, group_id) VALUES ($1,$2)")
                    .bind(id)
                    .bind(g)
                    .execute(&mut *tx)
                    .await?;
            }
        }
        let mut contract = None;
        if s.party_contract {
            sqlx::query("INSERT INTO resource_contracts (resource_id, contract_id) VALUES ($1,$2)")
                .bind(id)
                .bind(contract_ids[1])
                .execute(&mut *tx)
                .await?;
            contract = Some(contract_ids[1]);
        }
        resources.push(ResRec {
            id,
            collection: s.c,
            allow_recurring: s.recurring,
            blocks_only: s.blocks_only,
            allowed_groups: allowed,
            auto_confirm: s.auto_confirm,
            min_minutes: min.map(i64::from),
            max_minutes: max.map(i64::from),
            default_minutes: def.map(i64::from),
            reservable_until: until,
            contract,
        });
    }
    summary.resources = resources.len();
    let idx = |name: &str| {
        specs
            .iter()
            .position(|s| s.name == name)
            .expect("known resource")
    };

    // --- Restrictions and reservable blocks -----------------------------------------------
    // Global blackout around Christmas, exempting the admin office group.
    let xmas = NaiveDate::from_ymd_opt(opts.anchor.year(), 12, 24).expect("valid date");
    let restr_id: Uuid = sqlx::query_scalar(
        "INSERT INTO restrictions (title, description) VALUES ($1, $2) RETURNING id",
    )
    .bind(RESTRICTIONS[0])
    .bind("Tilat suljettu joulun ajaksi.")
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time) VALUES ($1, NULL, $2, $3)")
        .bind(restr_id)
        .bind(hel(xmas, 0, 0))
        .bind(hel(xmas + Duration::days(3), 0, 0))
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO restriction_exemptions (restriction_id, group_id) VALUES ($1, $2)")
        .bind(restr_id)
        .bind(admin_group)
        .execute(&mut *tx)
        .await?;
    // Resource-specific renovation, starting right after the anchor day.
    let renov: Uuid = sqlx::query_scalar(
        "INSERT INTO restrictions (title, description) VALUES ($1, $2) RETURNING id",
    )
    .bind(RESTRICTIONS[1])
    .bind("Remontti: sali ei käytettävissä.")
    .fetch_one(&mut *tx)
    .await?;
    let renov_start = month_start + Duration::days(40);
    sqlx::query("INSERT INTO restriction_occurrences (restriction_id, resource_id, start_time, end_time) VALUES ($1, $2, $3, $4)")
        .bind(renov)
        .bind(resources[idx("Sali 101")].id)
        .bind(hel(renov_start, 0, 0))
        .bind(hel(renov_start + Duration::days(7), 0, 0))
        .execute(&mut *tx)
        .await?;

    // Weekday teaching hours: the only times Sali 101 (blocks_only) can be reserved.
    let block_id: Uuid = sqlx::query_scalar(
        "INSERT INTO reservable_blocks (title, description, rrule) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(BLOCKS[0])
    .bind("Arkisin klo 8-18.")
    .bind(format!(
        "DTSTART;TZID=Europe/Helsinki:{}T080000\nRRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;UNTIL={}T235959Z",
        (month_start - Duration::days(30)).format("%Y%m%d"),
        (month_start + Duration::days(120)).format("%Y%m%d"),
    ))
    .fetch_one(&mut *tx)
    .await?;
    let mut d = month_start - Duration::days(30);
    while d <= month_start + Duration::days(120) {
        if d.weekday().number_from_monday() <= 5 {
            sqlx::query("INSERT INTO reservable_block_occurrences (block_id, resource_id, start_time, end_time) VALUES ($1,$2,$3,$4)")
                .bind(block_id)
                .bind(resources[idx("Sali 101")].id)
                .bind(hel(d, 8, 0))
                .bind(hel(d, 18, 0))
                .execute(&mut *tx)
                .await?;
        }
        d += Duration::days(1);
    }

    // --- Rounds ---------------------------------------------------------------------------
    let round_res = [idx("Sali 102"), idx("Neuvotteluhuone A")];
    let next_month = add_months(month_start, 1);
    let round_defs: [(&str, NaiveDate, NaiveDate, NaiveDate, NaiveDate, &str); 3] = [
        (
            ROUNDS[0],
            opts.anchor - Duration::days(75),
            opts.anchor - Duration::days(60),
            opts.anchor - Duration::days(45),
            opts.anchor - Duration::days(14),
            "completed",
        ),
        (
            ROUNDS[1],
            opts.anchor - Duration::days(7),
            opts.anchor + Duration::days(10),
            next_month,
            add_months(next_month, 3),
            "active",
        ),
        (
            ROUNDS[2],
            opts.anchor + Duration::days(20),
            opts.anchor + Duration::days(40),
            add_months(next_month, 4),
            add_months(next_month, 7),
            "active",
        ),
    ];
    let mut round_ids = vec![];
    for (name, open, close, from, to, status) in round_defs {
        let completed = status == "completed";
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO reservation_rounds (name, description, applications_open_at, applications_close_at, \
             period_start, period_end, max_pending_per_resource, status, completed_at, completed_by, allocation_saved_at) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text::round_status,$9,$10,$11) RETURNING id",
        )
        .bind(name)
        .bind("Hae vakiovuoroja valituille tiloille hakuaikana.")
        .bind(hel(open, 8, 0))
        .bind(hel(close, 16, 0))
        .bind(hel(from, 0, 0))
        .bind(hel(to, 0, 0))
        .bind(3)
        .bind(status)
        .bind(completed.then(|| hel(close + Duration::days(2), 10, 0)))
        .bind(completed.then_some(admin_id))
        .bind(completed.then(|| hel(close + Duration::days(1), 10, 0)))
        .fetch_one(&mut *tx)
        .await?;
        for &r in &round_res {
            sqlx::query(
                "INSERT INTO reservation_round_resources (round_id, resource_id) VALUES ($1,$2)",
            )
            .bind(id)
            .bind(resources[r].id)
            .execute(&mut *tx)
            .await?;
        }
        for g in org_groups {
            sqlx::query("INSERT INTO reservation_round_groups (round_id, group_id) VALUES ($1,$2)")
                .bind(id)
                .bind(g)
                .execute(&mut *tx)
                .await?;
        }
        round_ids.push(id);
    }
    summary.rounds = round_ids.len();
    // Normal bookings are not allowed on round resources once the active round's period starts.
    let round_block_from = hel(next_month, 0, 0);

    let org_users: Vec<usize> = users
        .iter()
        .enumerate()
        .filter(|(_, u)| org_groups.contains(&u.group_id))
        .map(|(i, _)| i)
        .collect();

    // Round applications. Each application is its own reservation with a single occurrence (one
    // slot) and a priority; applicants list 2-3 alternatives per resource, and different
    // applicants compete for the same slots from a shared pool. In the completed round the
    // allocation is already done: the first applicant to get a slot keeps it (confirmed), every
    // other application is cancelled. In the active round everything is still pending.
    let mut all: Vec<NewResv> = vec![];
    let applicants_per_round = if prod { 10 } else { 5 };
    for (round_no, from) in [(0usize, round_defs[0].3), (1usize, round_defs[1].3)] {
        let completed = round_no == 0;
        let mut taken = std::collections::HashSet::new();
        let mut granted = std::collections::HashSet::new();
        let mut applicants = std::collections::HashSet::new();
        while applicants.len() < applicants_per_round {
            let u = &users[*rng.pick(&org_users)];
            if !applicants.insert(u.id) {
                continue;
            }
            let r = *rng.pick(&round_res);
            // Shared slot pool: weekday evenings plus two lunch slots
            let pool: Vec<(i64, u32)> = vec![
                (0, 17),
                (1, 17),
                (2, 17),
                (3, 17),
                (4, 17),
                (1, 12),
                (3, 12),
            ];
            let mut picks: Vec<(i64, u32)> = vec![];
            let wanted = 2 + rng.below(2);
            while picks.len() < wanted {
                let s = *rng.pick(&pool);
                if !picks.contains(&s) {
                    picks.push(s);
                }
            }
            let title = format!("Vakiovuoro: {}", rng.pick(TITLES));
            let applied_at = hel(
                round_defs[round_no].1 + Duration::days(rng.range(0, 10)),
                12,
                0,
            );
            for (prio, (day, hour)) in picks.into_iter().enumerate() {
                let date = from + Duration::days(day);
                let (s, e) = (hel(date, hour, 0), hel(date, hour + 2, 0));
                let mut resv = NewResv::simple(u.id, title.clone(), "pending", applied_at);
                resv.round = Some((round_ids[round_no], prio as i32 + 1));
                resv.occurrences = vec![(resources[r].id, s, e)];
                if completed {
                    if taken.contains(&(r, day, hour)) || granted.contains(&(u.id, r)) {
                        resv.status = "cancelled";
                        resv.cancelled = Some((
                            hel(round_defs[0].3, 10, 0),
                            admin_id,
                            "Ei saanut vuoroa.".into(),
                        ));
                    } else {
                        taken.insert((r, day, hour));
                        granted.insert((u.id, r));
                        resv.status = "confirmed";
                    }
                } else if applicants.len() == 2 && prio == 2 {
                    // One alternative withdrawn by the applicant
                    resv.status = "cancelled";
                    resv.cancelled = Some((
                        applied_at + Duration::days(1),
                        u.id,
                        "Peruttu hakijan toimesta.".into(),
                    ));
                }
                all.push(resv);
            }
        }
    }

    // --- Regular reservations -------------------------------------------------------------
    let total = if prod { 260 } else { 45 };
    let mut busy: Vec<Vec<(Dt, Dt)>> = vec![vec![]; resources.len()];
    // Round allocations (confirmed) occupy their slots.
    for r in all.iter().filter(|r| r.status == "confirmed") {
        for (rid, s, e) in &r.occurrences {
            if let Some(i) = resources.iter().position(|x| x.id == *rid) {
                busy[i].push((*s, *e));
            }
        }
    }
    let range_start = month_start - Duration::days(21);
    let range_days = 31 + 21 + 45;
    let mut made = 0;
    let mut attempts = 0;
    while made < total && attempts < total * 40 {
        attempts += 1;
        // 65% of reservations land in the anchor month so the month view is dense.
        let day = if rng.chance(65) {
            month_start + Duration::days(rng.range(0, 30))
        } else {
            range_start + Duration::days(rng.range(0, range_days))
        };

        // Pick user and a resource they may use.
        let u = &users[rng.below(users.len())];
        let mut ri = rng.below(resources.len());
        if !specs[ri].public && !u.admin {
            ri = idx("Neuvotteluhuone A");
        }
        let res = &resources[ri];
        if !res.allowed_groups.is_empty() && !res.allowed_groups.contains(&u.group_id) {
            continue;
        }
        if res.blocks_only && day.weekday().number_from_monday() > 5 {
            continue;
        }
        let in_round_res = round_res.contains(&ri);

        // Duration and start time.
        let dur = {
            let pool = [60, 90, 120, 120, 180, 240];
            let mut m = res
                .default_minutes
                .filter(|_| rng.chance(40))
                .unwrap_or(*rng.pick(&pool));
            if let Some(lo) = res.min_minutes {
                m = m.max(lo)
            }
            if let Some(hi) = res.max_minutes {
                m = m.min(hi)
            }
            m
        };
        let multi_day = dur >= 1440;
        let (sh, sm) = if res.blocks_only {
            (8 + rng.range(0, 6) as u32, 0)
        } else {
            (
                8 + rng.range(0, 14) as u32,
                if rng.chance(50) { 0 } else { 30 },
            )
        };
        let start = hel(day, sh, sm);
        let mut end = start + Duration::minutes(dur);
        if res.blocks_only && end > hel(day, 18, 0) {
            end = hel(day, 18, 0);
            if end <= start {
                continue;
            }
        }
        if let Some(until) = res.reservable_until
            && end > until
        {
            continue;
        }
        if in_round_res && start >= round_block_from {
            continue;
        }
        if !multi_day && end > hel(day, 23, 59) {
            continue;
        }

        // Occurrences: single, weekly recurring, or two resources.
        let recurring = res.allow_recurring && !res.blocks_only && rng.chance(10);
        let (count, interval) = if recurring {
            (rng.range(3, 9), if rng.chance(30) { 2 } else { 1 })
        } else {
            (1, 1)
        };
        let mut occs: Vec<(usize, Dt, Dt)> = (0..count)
            .map(|k| {
                (
                    ri,
                    start + Duration::days(7 * interval * k),
                    end + Duration::days(7 * interval * k),
                )
            })
            .collect();
        if !recurring && !multi_day && rng.chance(10) {
            let others: Vec<usize> = (0..resources.len())
                .filter(|&i| {
                    i != ri
                        && resources[i].collection == res.collection
                        && resources[i].allowed_groups.is_empty()
                        && !resources[i].blocks_only
                })
                .collect();
            if !others.is_empty() {
                occs.push((*rng.pick(&others), start, end));
            }
        }
        if occs.iter().any(|(i, s, _)| {
            resources[*i].reservable_until.is_some_and(|u| *s > u)
                || (round_res.contains(i) && *s >= round_block_from)
        }) {
            continue;
        }

        // Status.
        let status: &'static str = if res.auto_confirm && rng.chance(80) {
            "confirmed"
        } else if start < now {
            if rng.chance(88) {
                "confirmed"
            } else {
                "cancelled"
            }
        } else {
            match rng.below(100) {
                0..=59 => "confirmed",
                60..=89 => "pending",
                _ => "cancelled",
            }
        };
        if status == "confirmed" && occs.iter().any(|(i, s, e)| overlaps(&busy[*i], *s, *e)) {
            continue;
        }

        let title = if made == 3 {
            LONG_TITLE.to_string()
        } else {
            rng.pick(TITLES).to_string()
        };
        let created_at = (start - Duration::days(rng.range(1, 40))).min(now);
        let mut resv = NewResv::simple(u.id, title, status, created_at);
        resv.occurrences = occs
            .iter()
            .map(|(i, s, e)| (resources[*i].id, *s, *e))
            .collect();
        if recurring {
            resv.rrule = Some(rrule_string(day, sh, sm, interval, count));
        }
        match rng.below(10) {
            0..=3 => resv.description_rich = Some(i18n_doc(rng.pick(DESCRIPTIONS))),
            4..=5 => resv.description = Some(rng.pick(DESCRIPTIONS).to_string()),
            _ => {}
        }
        resv.contact = u.contact.clone().filter(|_| rng.chance(70));
        if status == "pending" && rng.chance(25) {
            resv.message_to_admins =
                Some("Voisiko varauksen vahvistaa viikon sisällä? Kiitos!".into());
        }
        if status == "confirmed" {
            if rng.chance(25) {
                resv.admin_notes = Some("Avaimet noudettava toimistolta.".into());
            }
            resv.contract_id = res.contract.filter(|_| rng.chance(60));
        }
        if status == "cancelled" {
            let by = if rng.chance(50) { u.id } else { admin_id };
            resv.cancelled = Some((
                created_at + Duration::days(1),
                by,
                rng.pick(CANCEL_REASONS).to_string(),
            ));
        } else if status == "confirmed" {
            for (i, s, e) in &occs {
                busy[*i].push((*s, *e));
            }
        }
        all.push(resv);
        made += 1;
    }

    // A few days with many small reservations on one resource, to exercise month-view overflow.
    let busy_day = month_start + Duration::days(11);
    let ri = idx("Kabinetti");
    for k in 0..8 {
        let u = &users[(k * 3 + 2) % users.len()];
        let start = hel(busy_day, 8 + k as u32, 0);
        let end = start + Duration::minutes(45);
        if overlaps(&busy[ri], start, end) {
            continue;
        }
        busy[ri].push((start, end));
        let mut r = NewResv::simple(
            u.id,
            format!("Pikatapaaminen {}", k + 1),
            "confirmed",
            now - Duration::days(5),
        );
        r.occurrences = vec![(resources[ri].id, start, end)];
        all.push(r);
    }

    // Outlook-sourced, read-only reservations.
    for (n, name) in ["Kristallisali", "Neuvotteluhuone A"].iter().enumerate() {
        let ri = idx(name);
        for k in 0..3 {
            let day = month_start + Duration::days(2 + 9 * k + n as i64);
            let start = hel(day, 18, 0);
            let end = start + Duration::minutes(120);
            if overlaps(&busy[ri], start, end) {
                continue;
            }
            busy[ri].push((start, end));
            let mut r = NewResv::simple(
                admin_id,
                format!("Outlook: {} {}", name, k + 1),
                "confirmed",
                now - Duration::days(10),
            );
            r.source = "outlook";
            r.ical_uid = Some(format!("mock-outlook-{n}-{k}@{MOCK_DOMAIN}"));
            r.occurrences = vec![(resources[ri].id, start, end)];
            all.push(r);
        }
    }

    // --- Insert reservations --------------------------------------------------------------
    for r in &all {
        insert_reservation(&mut tx, r).await?;
        summary.reservations += 1;
        summary.occurrences += r.occurrences.len();
    }

    // Outlook sync log samples.
    for (i, result) in ["imported", "updated", "cancelled", "ignored", "error"]
        .iter()
        .enumerate()
    {
        sqlx::query("INSERT INTO outlook_sync_log (graph_message_id, received_at, subject, result, detail) VALUES ($1,$2,$3,$4,$5)")
            .bind(format!("mock-msg-{i}"))
            .bind(now - Duration::hours(i as i64 * 7))
            .bind(format!("Meeting invite {i}"))
            .bind(result)
            .bind((*result == "error").then_some("Could not parse invite"))
            .execute(&mut *tx)
            .await?;
    }

    summary.news = seed_news(&mut tx, &mut rng, &users, now, org_groups[0], staff_group).await?;

    tx.commit().await.context("commit mock data")?;
    Ok(summary)
}

/// News items: every visibility level, a draft, a scheduled item, current and expired highlights,
/// and read rows. `user@example.test` (in `member_group`) is left with a few unread items.
async fn seed_news(
    tx: &mut Transaction<'_, Postgres>,
    rng: &mut Rng,
    users: &[UserRec],
    now: Dt,
    member_group: Uuid,
    staff_group: Uuid,
) -> Result<usize> {
    struct Item {
        visibility: &'static str,
        groups: Vec<Uuid>,
        /// Days before `now`; None = draft, negative = scheduled
        published_days_ago: Option<i64>,
        /// None = not highlighted; Some(None) = highlighted until removed
        highlight_until_days: Option<Option<i64>>,
        rich_body: bool,
    }
    let item = |visibility, published_days_ago, highlight_until_days| Item {
        visibility,
        groups: vec![],
        published_days_ago,
        highlight_until_days,
        rich_body: false,
    };
    let items = [
        Item {
            rich_body: true,
            ..item("public", Some(1), Some(Some(40)))
        },
        Item {
            rich_body: true,
            ..item("users", Some(3), Some(None))
        },
        item("public", Some(20), Some(Some(-2))),
        item("users", Some(6), None),
        Item {
            groups: vec![member_group],
            ..item("groups", Some(4), None)
        },
        Item {
            groups: vec![staff_group],
            ..item("groups", Some(8), None)
        },
        item("public", Some(30), None),
        Item {
            rich_body: true,
            ..item("public", Some(45), None)
        },
        item("users", Some(60), None),
        item("public", Some(90), None),
        item("users", None, None),
        item("users", Some(-5), Some(Some(30))),
    ];
    let author = users[0].id;
    let mut ids = vec![];
    for ((fi, sv, en), it) in NEWS.iter().zip(items.iter()) {
        let title = json!({"fi": fi, "sv": sv, "en": en});
        let blurb = json!({
            "fi": format!("{fi}: lyhyt kuvaus, joka näkyy listassa ja etusivulla."),
            "sv": format!("{sv}: en kort beskrivning som visas i listan och på startsidan."),
            "en": format!("{en}: a short summary shown in the list and on the home page."),
        });
        let body_doc = |heading: &str, text: &str| {
            if it.rich_body {
                json!({"type": "doc", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": text}]},
                    {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": heading}]},
                    {"type": "bulletList", "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "1."}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "2."}]}]},
                    ]},
                ]})
            } else {
                doc(text)
            }
        };
        let body = json!({
            "fi": body_doc("Muistettavaa", "Esimerkkitiedote. Tähän kirjoitetaan tiedotteen koko teksti."),
            "sv": body_doc("Att komma ihåg", "Exempelmeddelande. Här skrivs hela texten."),
            "en": body_doc("Good to know", "Example news item. The full text goes here."),
        });
        let published_at = it.published_days_ago.map(|d| now - Duration::days(d));
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO news (title, blurb, body, visibility, published_at, highlighted, highlight_until, created_by, created_at) \
             VALUES ($1, $2, $3, $4::text::news_visibility, $5, $6, $7, $8, $9) RETURNING id",
        )
        .bind(title)
        .bind(blurb)
        .bind(body)
        .bind(it.visibility)
        .bind(published_at)
        .bind(it.highlight_until_days.is_some())
        .bind(it.highlight_until_days.flatten().map(|d| now + Duration::days(d)))
        .bind(author)
        .bind(published_at.unwrap_or(now) - Duration::hours(2))
        .fetch_one(&mut **tx)
        .await?;
        for group_id in &it.groups {
            sqlx::query("INSERT INTO news_visibility_groups (news_id, group_id) VALUES ($1, $2)")
                .bind(id)
                .bind(group_id)
                .execute(&mut **tx)
                .await?;
        }
        ids.push((id, it.published_days_ago));
    }

    // Older items (a week or more) are read by some users; admin and user@example.test have
    // read all of them, so their newest items stay unread.
    for (index, user) in users.iter().enumerate() {
        for (id, days_ago) in &ids {
            let Some(days_ago) = *days_ago else { continue };
            let old = days_ago >= 7;
            let read = if index < 2 {
                old
            } else {
                old && rng.chance(40)
            };
            if read {
                sqlx::query("INSERT INTO news_reads (user_id, news_id, read_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
                    .bind(user.id)
                    .bind(id)
                    .bind(now - Duration::days(days_ago - 1))
                    .execute(&mut **tx)
                    .await?;
            }
        }
    }

    Ok(ids.len())
}

fn base_clone<'a, T: Clone>(t: &'a T) -> T {
    t.clone()
}

async fn insert_reservation(tx: &mut Transaction<'_, Postgres>, r: &NewResv) -> Result<()> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO reservations (user_id, title, description, description_rich, rrule, status, admin_notes, \
         message_to_admins, contact_person, contact_email, contact_phone, contract_id, cancelled_at, cancelled_by, \
         cancel_reason, source, ical_uid, ical_sequence, round_id, round_priority, created_at) \
         VALUES ($1,$2,$3,$4,$5,$6::text::reservation_status,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) \
         RETURNING id",
    )
    .bind(r.user_id)
    .bind(&r.title)
    .bind(&r.description)
    .bind(&r.description_rich)
    .bind(&r.rrule)
    .bind(r.status)
    .bind(&r.admin_notes)
    .bind(&r.message_to_admins)
    .bind(r.contact.as_ref().map(|c| c.0.clone()))
    .bind(r.contact.as_ref().map(|c| c.1.clone()))
    .bind(r.contact.as_ref().map(|c| c.2.clone()))
    .bind(r.contract_id)
    .bind(r.cancelled.as_ref().map(|c| c.0))
    .bind(r.cancelled.as_ref().map(|c| c.1))
    .bind(r.cancelled.as_ref().map(|c| c.2.clone()))
    .bind(r.source)
    .bind(&r.ical_uid)
    .bind(r.ical_uid.as_ref().map(|_| 0i32))
    .bind(r.round.map(|x| x.0))
    .bind(r.round.map(|x| x.1))
    .bind(r.created_at)
    .fetch_one(&mut **tx)
    .await?;
    for (res, s, e) in &r.occurrences {
        sqlx::query("INSERT INTO occurrences (reservation_id, resource_id, start_time, end_time) VALUES ($1,$2,$3,$4)")
            .bind(id)
            .bind(res)
            .bind(s)
            .bind(e)
            .execute(&mut **tx)
            .await?;
    }
    if let Some((round, _)) = r.round
        && r.status == "confirmed"
    {
        sqlx::query(
            "INSERT INTO reservation_round_allocations (round_id, reservation_id) VALUES ($1,$2)",
        )
        .bind(round)
        .bind(id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
