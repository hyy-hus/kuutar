-- Resources flagged `blocks_only` can only be reserved by non-admins in whole reservable blocks.
ALTER TABLE resources ADD COLUMN blocks_only BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE reservable_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rrule VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Materialized occurrences of a block. A reservation matches a block by exact
-- (resource_id, start_time, end_time); there is deliberately no FK from `occurrences`
-- so editing a block never touches existing reservations.
CREATE TABLE reservable_block_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES reservable_blocks(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_block_occ_time_order CHECK (start_time < end_time)
);

CREATE INDEX idx_block_occurrences_resource_time
    ON reservable_block_occurrences (resource_id, start_time, end_time);
CREATE INDEX idx_block_occurrences_block ON reservable_block_occurrences (block_id);
