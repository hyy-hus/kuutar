-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER set_groups_updated_at
BEFORE UPDATE ON groups
FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enforce unique active group names
CREATE UNIQUE INDEX idx_groups_unique_active_name
ON groups(LOWER(name))
WHERE deleted_at IS NULL;


-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Foreign key index for JOINs and CASCADE operations
CREATE INDEX idx_users_group_id ON users(group_id);

-- Enforce unique email among ACTIVE users only (case-insensitive)
CREATE UNIQUE INDEX idx_users_unique_active_email
ON users (LOWER(email))
WHERE deleted_at IS NULL;


-- REFRESH TOKENS TABLE
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ DEFAULT NULL
);

-- FK index for user token lookups (e.g. revoking all sessions for a user)
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Partial index for fast validation of unrevoked tokens
CREATE INDEX idx_refresh_tokens_active_hash
ON refresh_tokens(token_hash)
WHERE revoked_at IS NULL;
