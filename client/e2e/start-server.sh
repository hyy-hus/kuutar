#!/usr/bin/env bash
# Starts a throwaway API server for e2e tests on its own database, so the
# dev database and a running dev server are never touched.
set -euo pipefail

# Admin connection used only to drop and recreate the e2e database. Defaults match
# the CI Postgres service; locally set E2E_ADMIN_DATABASE_URL to your own credentials.
ADMIN_URL="${E2E_ADMIN_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
E2E_DB="kuutar_e2e"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)" \
  -c "CREATE DATABASE $E2E_DB"

# Same host/credentials as the admin URL, different database.
export DATABASE_URL="${ADMIN_URL%/*}/$E2E_DB"
export BIND_ADDR="127.0.0.1:${E2E_API_PORT:-3100}"
export JWT_SECRET="e2e-only-secret"
export SEED_ADMIN_EMAIL="admin@localhost"
export SEED_ADMIN_PASSWORD="Admin"
export APP_BASE_URL="http://localhost:${E2E_CLIENT_PORT:-5174}"
export S3_BUCKET_NAME="e2e"
export S3_ENDPOINT="http://127.0.0.1:9"
export S3_REGION="eu-north-1"
export AWS_ACCESS_KEY_ID="e2e"
export AWS_SECRET_ACCESS_KEY="e2e"

cd "$(dirname "$0")/../../server"
exec cargo run --quiet
