-- Create restriction occurrences table
CREATE TABLE restriction_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restriction_id UUID NOT NULL REFERENCES restrictions(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, -- NULL = applies globally
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_restriction_occ_time_order CHECK (start_time < end_time)
);

-- Fast range index for restriction occurrences
CREATE INDEX idx_restriction_occ_range ON restriction_occurrences USING gist (
    tstzrange(start_time, end_time, '[)')
);

-- Drop deprecated columns from restrictions table
ALTER TABLE restrictions DROP COLUMN IF EXISTS start_time;
ALTER TABLE restrictions DROP COLUMN IF EXISTS end_time;

-- Drop deprecated join table if it existed
DROP TABLE IF EXISTS restriction_resources;
