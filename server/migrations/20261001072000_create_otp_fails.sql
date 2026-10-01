-- Add migration script here
CREATE TABLE IF NOT EXISTS otp_fails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_fails_email_attempted_at ON otp_fails(LOWER(email), attempted_at);
