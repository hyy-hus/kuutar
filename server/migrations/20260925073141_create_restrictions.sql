-- Restrictions table
CREATE TABLE restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_restriction_time_order CHECK (start_time < end_time)
);

-- Fast range lookup index for restrictions
CREATE INDEX idx_restrictions_time_range ON restrictions USING gist (
    tstzrange(start_time, end_time, '[)')
) WHERE deleted_at IS NULL;

-- Optional binding to specific resources (NULL resource link = applies to ALL resources globally)
CREATE TABLE restriction_resources (
    restriction_id UUID NOT NULL REFERENCES restrictions(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    PRIMARY KEY (restriction_id, resource_id)
);

-- Exemptions: Groups allowed to bypass a restriction
CREATE TABLE restriction_exemptions (
    restriction_id UUID NOT NULL REFERENCES restrictions(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restriction_id, group_id)
);
