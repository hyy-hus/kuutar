-- Admin impersonation: a session started by an admin acting as another user.
-- The chain belongs to the target user; impersonator_id is the admin behind it.
ALTER TABLE refresh_tokens
    ADD COLUMN impersonator_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Allow 'impersonation_end' as a revoke reason (all existing values stay valid)
ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_revoked_reason_check;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_revoked_reason_check
    CHECK (revoked_reason IN ('rotated', 'logout', 'admin', 'password', 'reuse', 'user_deleted', 'impersonation_end'));
