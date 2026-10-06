-- Outlook (Microsoft Graph) calendar integration

-- Address of the resource's Outlook room/equipment mailbox; invite attendees are matched against it
ALTER TABLE resources ADD COLUMN outlook_email TEXT
    CHECK (outlook_email = LOWER(outlook_email));
CREATE UNIQUE INDEX idx_resources_unique_outlook_email
    ON resources(outlook_email)
    WHERE outlook_email IS NOT NULL AND deleted_at IS NULL;

-- Where a reservation originates; Outlook-sourced ones are edited in Outlook
ALTER TABLE reservations
    ADD COLUMN source TEXT NOT NULL DEFAULT 'kuutar' CHECK (source IN ('kuutar', 'outlook')),
    ADD COLUMN ical_uid TEXT,
    ADD COLUMN ical_sequence INTEGER;
CREATE UNIQUE INDEX idx_reservations_unique_ical_uid
    ON reservations(ical_uid)
    WHERE ical_uid IS NOT NULL;

-- One row per processed intake message: idempotency and an audit trail for admins
CREATE TABLE outlook_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_message_id TEXT NOT NULL UNIQUE,
    received_at TIMESTAMPTZ,
    subject TEXT,
    ical_uid TEXT,
    result TEXT NOT NULL CHECK (result IN ('imported', 'updated', 'cancelled', 'ignored', 'error')),
    detail TEXT,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outlook_sync_log_created_at ON outlook_sync_log(created_at DESC);
