-- Session management: a session is a chain of rotated refresh tokens sharing a session_id.
-- Existing rows each become their own single-token session.
ALTER TABLE refresh_tokens
    ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN session_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN user_agent TEXT,
    ADD COLUMN ip TEXT,
    ADD COLUMN revoked_reason TEXT
        CONSTRAINT refresh_tokens_revoked_reason_check
        CHECK (revoked_reason IN ('rotated', 'logout', 'admin', 'password', 'reuse', 'user_deleted'));

-- Backfill: an existing token's session started when it was created
UPDATE refresh_tokens SET session_started_at = created_at;

CREATE INDEX idx_refresh_tokens_user_session ON refresh_tokens(user_id, session_id);
