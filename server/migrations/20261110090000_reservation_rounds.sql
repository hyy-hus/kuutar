-- Reservation rounds: groups apply for blocks of blocks_only resources during a window,
-- admins allocate and complete the round. Purely additive.

CREATE TYPE round_status AS ENUM ('active', 'completed');

CREATE TABLE reservation_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    applications_open_at TIMESTAMPTZ NOT NULL,
    applications_close_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    max_pending_per_resource INTEGER NOT NULL CHECK (max_pending_per_resource >= 1),
    status round_status NOT NULL DEFAULT 'active',
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users (id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rounds_window_order CHECK (applications_open_at < applications_close_at),
    CONSTRAINT rounds_period_order CHECK (period_start < period_end)
);

CREATE TABLE reservation_round_resources (
    round_id UUID NOT NULL REFERENCES reservation_rounds (id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources (id),
    PRIMARY KEY (round_id, resource_id)
);
CREATE INDEX idx_round_resources_resource ON reservation_round_resources (resource_id);

CREATE TABLE reservation_round_groups (
    round_id UUID NOT NULL REFERENCES reservation_rounds (id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups (id),
    PRIMARY KEY (round_id, group_id)
);

ALTER TABLE reservations
    ADD COLUMN round_id UUID REFERENCES reservation_rounds (id),
    ADD COLUMN round_priority INTEGER;
CREATE INDEX idx_reservations_round ON reservations (round_id) WHERE round_id IS NOT NULL;

-- Saved allocation draft: reservations to be granted when the round completes.
CREATE TABLE reservation_round_allocations (
    round_id UUID NOT NULL REFERENCES reservation_rounds (id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
    PRIMARY KEY (round_id, reservation_id)
);
-- Marks that a draft was saved (possibly empty), required before completing.
ALTER TABLE reservation_rounds ADD COLUMN allocation_saved_at TIMESTAMPTZ;
