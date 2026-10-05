-- Resources flagged `reservation_restricted` can only be reserved by non-admins whose
-- group is listed in `resource_groups`. Visibility is unaffected (see `is_public`).
ALTER TABLE resources ADD COLUMN reservation_restricted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE resource_groups (
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource_id, group_id)
);

CREATE INDEX idx_resource_groups_group ON resource_groups (group_id);
