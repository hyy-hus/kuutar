-- Rate limit counters for the auth endpoints (#111). Rows older than a day are purged daily.
CREATE TABLE IF NOT EXISTS auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Which limit the row counts towards, e.g. 'login_email' or 'otp_request_ip'
    action TEXT NOT NULL,
    -- Lowercased email or client IP address
    key TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_action_key_attempted_at
    ON auth_attempts (action, key, attempted_at);
