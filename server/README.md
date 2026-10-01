# Kuutar – palvelin

Kuutarin REST-rajapinta: Rust, [Axum](https://github.com/tokio-rs/axum), [SQLx](https://github.com/launchbadge/sqlx) ja PostgreSQL. Projektin yleiskuvaus ja koko kehitysympäristön käynnistys löytyvät [juuren README:stä](../README.md).

## Käynnistys

```sh
cp .env.example .env   # tietokanta, JWT-salaisuus, S3 ja valinnainen Resend-avain
cargo run
```

Käynnistyessään palvelin:
1. ajaa hakemiston `migrations/` tietokantamigraatiot
2. luo ylläpitäjän tunnuksilla `SEED_ADMIN_EMAIL` ja `SEED_ADMIN_PASSWORD`, jos ylläpitäjää ei vielä ole
3. kuuntelee osoitetta `BIND_ADDR` (oletuksena `127.0.0.1:3000`)

Rajapinnan dokumentaatio: http://127.0.0.1:3000/swagger-ui

## Ympäristömuuttujat

Kaikki muuttujat ja niiden esimerkkiarvot ovat tiedostossa [`.env.example`](.env.example).

| Muuttuja | Pakollinen | Kuvaus |
|---|---|---|
| `DATABASE_URL` | kyllä | PostgreSQL-yhteys |
| `JWT_SECRET` | kyllä | Tunnisteiden allekirjoitusavain |
| `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | kyllä | Sopimus-PDF:ien tallennus. Paikallisesti mitkä tahansa arvot riittävät käynnistykseen. |
| `S3_ENDPOINT`, `S3_REGION` | ei | Oletuksena Scaleway `fr-par` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | ei | Sähköpostiin lähetettävät kirjautumiskoodit |
| `BIND_ADDR`, `MAX_DB_CONNECTIONS`, `JWT_EXPIRATION_SECONDS` | ei | Palvelimen asetukset |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | ei | Ensimmäinen ylläpitäjä |

## Testit

```sh
cargo test
```

Integraatiotestit (`tests/`) käyttävät `#[sqlx::test]`-makroa, joka luo jokaiselle testille oman tietokannan muuttujan `DATABASE_URL` osoittamaan PostgreSQL-palvelimeen.

## SQL-kyselyiden välimuisti

SQLx tarkistaa kyselyt käännösaikana. Jotta palvelimen voi kääntää ilman tietokantaa (CI ja Docker, `SQLX_OFFLINE=true`), kyselyiden tiedot tallennetaan hakemistoon `.sqlx/`. Kun muutat kyselyitä, päivitä välimuisti ja lisää se committiin:

```sh
cargo sqlx prepare -- --all-targets
```

`--all-targets` on tarpeen, jotta myös testien kyselyt tallentuvat.
