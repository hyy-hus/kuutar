-- Who cancelled a reservation, when, and why (set by POST /reservations/{id}/cancel)
ALTER TABLE reservations
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN cancel_reason TEXT;
