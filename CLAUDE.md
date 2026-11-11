# Kuutar

Booking system for HYY's reservable spaces and resources. Rust (Axum, SQLx, PostgreSQL) server in `server/`, React (Vite, TanStack Router, Biome) client in `client/`. Public-facing READMEs are in Finnish; everything else (code comments, docs, commit messages, PR text) is in English.

## Dev environment

Everything runs under process-compose (`process-compose.yml`: `db`, `server` via `bacon --headless run`, `client` via vite on :5173). The user starts it with:

    process-compose up -f process-compose.yml -U -u /tmp/kuutar-pc.sock

Control the running instance with the same socket flags:

    process-compose process list -U -u /tmp/kuutar-pc.sock
    process-compose process restart server -U -u /tmp/kuutar-pc.sock
    process-compose process logs server -n 50 -U -u /tmp/kuutar-pc.sock

- Restart through process-compose. Never kill processes by PID and never start a second copy of the server or client.
- Don't pass `-f` to `logs` (it blocks); use `-n`.
- bacon rebuilds the server on file changes, so a restart is usually unnecessary.

## Before every commit

Run the checks CI runs and fix failures first:

- Server (`server/`): `cargo test --locked`
- Client (`client/`): `pnpm exec biome ci .`, `pnpm typecheck` and `pnpm test` (vitest unit tests)

New or changed logic in `client/src/utils/` gets a `*.test.ts` next to it. Component tests are `*.test.tsx` next to the component (happy-dom + Testing Library); render with `renderWithProviders` from `client/src/test/render.tsx` and assert on English text. Storybook (`pnpm storybook`) holds stories next to components (`*.stories.tsx`, run as tests with `pnpm test:stories`, not in CI yet). Mock API calls with `msw.use(...)` in a story's `beforeEach` and build data with `client/src/test/fixtures/` (fictional only, never production data). Add a story for new reusable components; verifying page-level UI changes is still manual. Playwright e2e lives in `client/e2e/` (`pnpm e2e`, issue #113). It runs its own API (:3100) and client (:5174) against a throwaway `kuutar_e2e` database, so it never touches dev data or the running dev servers. It needs `E2E_ADMIN_DATABASE_URL` set to a Postgres superuser URL (e.g. `DATABASE_URL` from `server/.env` ending in `/postgres`). Prefer role/label locators and English text (tests run in the `en-US` locale). Run `pnpm e2e` when a change touches user flows; it is not in CI yet.

## Mock data and screenshots

- **Mock data** (`server/src/seed/mock.rs`, bin `server/src/bin/seed.rs`): `cargo run --bin seed -- --size prod --reset` in `server/` fills the database in `DATABASE_URL` with a deterministic, fully fictional dataset (about 235 users, 300+ reservations, rounds, restrictions, blocks, ...). All mock users are `@example.test` with password `dev-password` (`admin@example.test`, `user@example.test`). `--reset` removes only what the seeder created; it refuses non-localhost databases. Never put real names or emails from production into the seeder, fixtures or stories.
- **Keep it in step:** when a change adds a table, column, status or other feature, extend the seeder so the new case is covered (and the `server/tests/seed_mock.rs` test if it adds an invariant). When you add, remove or rename a route in `client/src/routes/`, update the list in `client/e2e/screenshots/pages.spec.ts` (it covers every route; `/admin` is excluded because it only redirects).
- **Screenshots** (`docs/screenshots/pages/`, committed): `pnpm screenshots` in `client/` starts its own throwaway database (`kuutar_e2e`), API (:3100) and client (:5174), seeds the mock data with a pinned date (2026-11-11), and captures every page in fi/light plus en and dark variants for a few. It needs `E2E_ADMIN_DATABASE_URL`, like `pnpm e2e`. You cannot read `.env*`, so ask the user to run it with `!` and their own Postgres URL instead of guessing credentials. Each run deletes and rewrites `docs/screenshots/pages/`, so the repo only ever holds the current version; commit the whole result (`docs: update screenshots`).
- **Regenerate at least before every release**, and whenever a UI change makes the images misleading. Look at the new images before committing: a page that redirected to the front page or shows an error is a bug. The run fails on such redirects.

## Server

- If you add or change SQLx queries, run `cargo sqlx prepare -- --all-targets` in `server/` and commit the updated `.sqlx/`; CI builds offline and fails without it.
- Migrations live in `server/migrations/` with timestamped names (`YYYYMMDDHHMMSS_name.sql`). You may run them against the local dev DB.
- Migrations must never destroy existing data (no dropping columns/tables with data, no lossy type changes, no unguarded deletes). They also run automatically on the staging deploy, which is the reason. If a change would need data loss, stop and ask.
- After changing API endpoints or schemas, regenerate client types with `pnpm generate:api` in `client/` (needs the server running on :3000). It writes `client/src/api/schema.d.ts`.

## Client i18n

UI strings live in `client/messages/` (`fi.json`, `sv.json`, `en.json`). Draft new strings in Finnish, but a feature is not mergeable until Finnish, Swedish and English are all present. Add all three, and flag any translation you are unsure of.

## Git

- Commit style: `feat:`, `fix:`, `chore:`, optionally scoped (`fix(client):`).
- Work on feature branches. You may push them. Ask before opening a PR.
- Once the user has said they reviewed a PR and asked for it to be merged, you may merge it (`gh pr merge --merge`), delete its remote and local branch, and update local `main`. Never merge on your own initiative or before that go-ahead.
- Never push directly to `main` or run/modify the staging deploy. Merging a PR is the only way changes reach `main`; the deploy that follows is automatic, not yours to trigger.

## Don't touch

`server/reservations_backup.json`, `.env*` files and `deploy.sh` (all gitignored).
