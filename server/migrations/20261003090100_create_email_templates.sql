-- Admin-edited overrides for notification emails. Built-in defaults live in code,
-- so a missing row (or a missing language within a row) falls back to the default.
-- subject: {"fi": "text", ...}; body: {"fi": <Tiptap doc>, ...}
CREATE TABLE email_templates (
    key        VARCHAR(64) PRIMARY KEY CHECK (key IN ('reservation_created', 'reservation_confirmed', 'reservation_cancelled')),
    subject    JSONB NOT NULL DEFAULT '{}'::jsonb,
    body       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
