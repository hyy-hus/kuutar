# Kuutar

Kuutar on [Helsingin yliopiston ylioppilaskunnan (HYY)](https://hyy.fi) ajanvarausjärjestelmä HYY:n varattaville tiloille ja resursseille, kuten saunoille, kokoustiloille ja kalustolle. Järjestelmän omistaa ja sitä ylläpitää Helsingin yliopiston ylioppilaskunta.

Nimi tulee muinaissuomalaisesta kuun jumalattaresta Kuuttaresta.

- **Kokeile:** [testiympäristö](#testiympäristö)
- **Aja omalla koneella:** [Käyttöönotto paikallisesti](#käyttöönotto-paikallisesti)
- **Osallistu:** [Osallistuminen](#osallistuminen)

## Ominaisuudet

### Varaukset
- **Kalenterinäkymä**: yhden tai useamman päivän näkymä, resurssisuodatus ja nykyhetken osoitin. Uuden varauksen voi aloittaa tuplaklikkaamalla vapaata aikaa.
- **Kertaluonteiset ja toistuvat varaukset**: päivittäin, viikoittain, kuukausittain tai vuosittain toistuvat varaukset loppupäivään asti. Toistuvuuden voi sallia tai estää resurssikohtaisesti.
- **Useampi resurssi samaan varaukseen**: sama varaus voi koskea esimerkiksi saunaa ja kokoustilaa yhtä aikaa.
- **Päällekkäisyyksien tarkistus**: lomake tarkistaa päällekkäiset varaukset ja aikarajoitukset jo varausta tehtäessä.
- **Hyväksyntäprosessi**: käyttäjien varaukset ja niiden muutokset jäävät odottamaan ylläpidon hyväksyntää. Käyttäjä voi perua oman varauksensa tai palauttaa sen odottavaksi.
- **Omat varaukset**: odottavat, vahvistetut ja perutut varaukset kalenterikuukauden, neljännesvuoden, puolen vuoden tai koko vuoden jaksoissa.
- **Ylläpidon yhteystiedot ja muistiinpanot**: yhteyshenkilö, sähköposti, puhelinnumero ja sisäiset muistiinpanot näkyvät vain ylläpidolle.

### Resurssit ja rajoitukset
- **Resurssit ja kokoelmat**: resurssit ryhmitellään kokoelmiin, esimerkiksi rakennuksittain. Resurssin voi piilottaa tavallisilta käyttäjiltä ja sille voi asettaa viimeisen varattavissa olevan päivän.
- **Monikieliset kuvaukset**: kokoelmille, ryhmille ja resursseille voi kirjoittaa muotoillun kuvauksen (otsikot, listat, linkit) suomeksi, ruotsiksi ja englanniksi.
- **Aikarajoitukset**: ajanjaksot, joille ei voi varata, esimerkiksi huoltotöiden ajaksi. Rajoitus voi koskea yhtä tai useampaa resurssia tai kaikkia, se voi toistua, ja tietyt käyttäjäryhmät voidaan vapauttaa siitä.

### Sopimukset
- **Kieliversioidut sopimusasiakirjat**: PDF-sopimukset tallennetaan S3-yhteensopivaan objektitallennukseen. Sopimus voi olla yleinen tai koskea vain tiettyjä resursseja.
- **Ehtojen hyväksyminen**: käyttäjä hyväksyy varaukseen liittyvät voimassa olevat sopimukset ennen varauksen lähettämistä.
- **Sopimusten erätulostus**: ylläpito voi koota valituista varauksista yhden tulostettavan PDF:n. Siinä on jokaiselle varaukselle kansilehti, liittyvät sopimukset ja allekirjoitussivu.

### Käyttäjät ja ylläpito
- **Kirjautuminen**: salasanalla tai sähköpostiin lähetettävällä kertakäyttökoodilla (OTP, SMTP). Toistuvat virheelliset koodiyritykset lukitsevat kirjautumisen väliaikaisesti.
- **Käyttäjät, ryhmät ja roolit**: ylläpitäjät ja tavalliset käyttäjät. Ryhmiä käytetään esimerkiksi rajoituksista vapauttamiseen.
- **Käyttäjien massarekisteröinti**: CSV- tai TSV-tiedostosta tai leikepöydältä, esikatselun ja rivikohtaisten virheilmoitusten kera.
- **Ylläpidon hallintapaneeli**: odottavien pyyntöjen saapuneet-näkymä, varausten hyväksyntä ja peruminen sekä tilastot.
- **Varausten siirto**: varausten vienti ja tuonti JSON-muodossa ympäristöjen välillä resurssien nimien ja sähköpostiosoitteiden perusteella.
- **Haku**: resurssien ja varausten pikahaku.

### Muuta
- **Kolme kieltä**: käyttöliittymä on käännetty suomeksi, ruotsiksi ja englanniksi.
- **Avoin rajapinta**: REST-rajapinnan OpenAPI-kuvaus ja Swagger UI osoitteessa `/swagger-ui`.

## Testiympäristö

Kuutaria voi kokeilla testiympäristössä:

**https://kuutar-staging.s3-website.fr-par.scw.cloud/**

Kirjaudu ylläpitäjän tunnuksella:

| Sähköposti | Salasana |
|---|---|
| `admin@admin.fi` | `Admin` |

Testiympäristössä on käytössä vain salasanakirjautuminen. Sähköpostiin lähetettävä kertakäyttökoodi (OTP) ei toimi, koska testiympäristöllä ei ole SMTP-palvelinta määritettynä.

Testiympäristön tiedot voivat muuttua tai nollautua milloin tahansa, joten älä tallenna sinne mitään tärkeää.

## Teknologiat

| Osa | Teknologiat |
|---|---|
| Palvelin (`server/`) | Rust, [Axum](https://github.com/tokio-rs/axum), [SQLx](https://github.com/launchbadge/sqlx), PostgreSQL, [utoipa](https://github.com/juhaku/utoipa) (OpenAPI) |
| Käyttöliittymä (`client/`) | React 19, Vite, [TanStack Router, Query ja Form](https://tanstack.com), Tailwind CSS 4, [Tiptap](https://tiptap.dev), [i18next](https://www.i18next.com), [Biome](https://biomejs.dev) |
| Infrastruktuuri | Docker Compose (paikallinen tietokanta), Scaleway (S3-objektitallennus ja staattinen sivusto), GitHub Actions |

## Käyttöönotto paikallisesti

### Vaatimukset

- [Docker](https://docs.docker.com/get-docker/) ja Docker Compose
- [Rust](https://rustup.rs) (stable, vähintään 1.85 Rust 2024 -editiota varten)
- [Node.js](https://nodejs.org) 24 ja [pnpm](https://pnpm.io) 10

### 1. Tietokanta

Kopioi juuren ympäristömuuttujat ja käynnistä PostgreSQL:

```sh
cp .env.example .env   # muokkaa halutessasi DB_USER, DB_PASSWORD ja DB_NAME
docker compose up -d
```

Tietokanta on nyt osoitteessa `localhost:5432`.

### 2. Palvelin

```sh
cd server
cp .env.example .env   # päivitä DATABASE_URL vastaamaan juuren .env-tiedostoa
cargo run
```

Palvelin ajaa käynnistyessään tietokantamigraatiot automaattisesti. Jos ylläpitäjää ei vielä ole, se luo sellaisen tunnuksilla `SEED_ADMIN_EMAIL` ja `SEED_ADMIN_PASSWORD` (oletuksena `admin@localhost` / `Admin`).

Palvelin kuuntelee oletuksena osoitetta `http://127.0.0.1:3000`. Rajapinnan dokumentaatio löytyy osoitteesta http://127.0.0.1:3000/swagger-ui.

**Valinnaiset palvelut:**
- **S3-objektitallennus**: palvelin vaatii `S3_*`- ja `AWS_*`-muuttujat käynnistyäkseen. Paikallisesti mitkä tahansa arvot riittävät, mutta sopimus-PDF:ien lataaminen ja tulostus vaativat toimivan S3-yhteensopivan tallennuksen.
- **SMTP**: aseta `SMTP_HOST`, `SMTP_USERNAME` ja `SMTP_PASSWORD` (sekä tarvittaessa `SMTP_PORT`, `SMTP_TLS` ja `SMTP_FROM_EMAIL`), jos haluat käyttää sähköpostiin lähetettäviä kirjautumiskoodeja. Ilman palvelinta salasanakirjautuminen toimii normaalisti.

### 3. Käyttöliittymä

```sh
cd client
cp .env.example .env   # VITE_API_URL osoittaa palvelimeen
pnpm install
pnpm run dev
```

Käyttöliittymä aukeaa osoitteeseen http://localhost:5173. Jos portti on jo varattu, Vite kertoo siitä virheilmoituksella eikä vaihda porttia, joten osoite pysyy aina samana.

Kirjaudu sisään palvelimen luomilla ylläpitäjän tunnuksilla.

## Kehitys

### Hyödyllisiä komentoja

| Komento | Kuvaus |
|---|---|
| `cargo test` (`server/`) | Ajaa yksikkö- ja integraatiotestit. Integraatiotestit tarvitsevat käynnissä olevan PostgreSQL:n (`DATABASE_URL`). |
| `cargo sqlx prepare -- --all-targets` (`server/`) | Päivittää `.sqlx`-välimuistin SQL-kyselyiden muuttuessa. Tarvitaan, jotta palvelimen voi kääntää ilman tietokantaa (CI ja Docker). |
| `pnpm check` (`client/`) | Biome-lint ja -muotoilu |
| `pnpm typecheck` (`client/`) | TypeScript-tyyppitarkistus |
| `pnpm build` (`client/`) | Tuotantoversio hakemistoon `client/dist` |
| `pnpm generate:api` (`client/`) | Päivittää rajapinnan tyypit (`src/api/schema.d.ts`) käynnissä olevan palvelimen OpenAPI-kuvauksesta |
| `pnpm generate-routes` (`client/`) | Päivittää TanStack Routerin reittipuun |

### Hakemistorakenne

```
kuutar/
├── compose.yml              # Paikallinen PostgreSQL
├── server/                  # Rust-palvelin
│   ├── migrations/          # SQL-migraatiot (ajetaan käynnistyksessä)
│   ├── src/domains/         # Toiminnot aiheittain: auth, reservations, resources, contracts, …
│   ├── tests/               # Rajapinnan integraatiotestit
│   └── .sqlx/               # SQLx:n offline-kyselyvälimuisti
├── client/                  # React-käyttöliittymä
│   ├── messages/            # Käännökset: fi.json, sv.json, en.json
│   └── src/
│       ├── api/             # Rajapinta-asiakas ja generoidut tyypit
│       ├── components/      # Jaetut komponentit
│       ├── hooks/           # TanStack Query -hookit
│       └── routes/          # Sivut (tiedostopohjainen reititys)
└── .github/workflows/       # CI ja testiympäristön julkaisu
```

### Jatkuva integraatio

Jokaisessa pull requestissa ajetaan:
- **Client checks**: `biome ci` ja `tsc --noEmit`
- **Server checks**: `cargo test` PostgreSQL 18 -tietokantaa vasten

Muutokset `main`-haaraan julkaistaan automaattisesti testiympäristöön.

## Osallistuminen

Kaikenlainen osallistuminen on tervetullutta, oli kyse virheilmoituksista, parannusehdotuksista, käännöksistä tai koodista!

1. **Ilmoita ongelmasta tai ideasta** [GitHub-issuena](https://github.com/hyy-hus/kuutar/issues). Isommista muutoksista kannattaa keskustella issuessa ennen toteutusta.
2. **Tee muutokset omaan haaraan**, esimerkiksi `feat/varausten-vienti` tai `fix/kalenterin-aikavyohyke`.
3. **Kirjoita commit-viestit [Conventional Commits](https://www.conventionalcommits.org) -muodossa**, esimerkiksi `feat(client): …`, `fix(server): …` tai `docs: …`.
4. **Avaa pull request** `main`-haaraan ja kerro, mitä muutit ja miten sen voi testata.

Muistilista:
- **Käännökset**: kaikki käyttöliittymän tekstit kulkevat `t()`-funktion kautta, ja uudet avaimet lisätään kaikkiin kolmeen tiedostoon `client/messages/` (fi, sv, en).
- **SQL-kyselyt**: kun muutat kyselyitä, aja `cargo sqlx prepare -- --all-targets` ja lisää muuttunut `.sqlx`-hakemisto committiin.
- **Rajapinta**: kun muutat sitä, päivitä käyttöliittymän tyypit komennolla `pnpm generate:api`.
- **Tarkistukset**: varmista ennen pull requestia, että `pnpm check`, `pnpm typecheck` ja `cargo test` menevät läpi.

## Lisenssi

Kuutar on julkaistu [Apache License 2.0](LICENSE) -lisenssillä.
