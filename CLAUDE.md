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
- Client (`client/`): `pnpm exec biome ci .` and `pnpm typecheck`

Verifying UI changes is manual for now. Storybook and vitest are not part of the workflow yet, so don't add stories or rely on `pnpm test`.

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
- Never push to `main` or touch the staging deploy.

## Don't touch

`server/reservations_backup.json`, `.env*` files and `deploy.sh` (all gitignored).
