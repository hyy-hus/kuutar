-- Non-public resources (`is_public = FALSE`) are visible to admins, to groups listed in
-- `resource_visibility_groups` and to groups that may reserve them (`resource_groups`,
-- when `reservation_restricted`). An empty set means admins only.
CREATE TABLE resource_visibility_groups (
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource_id, group_id)
);

CREATE INDEX idx_resource_visibility_groups_group ON resource_visibility_groups (group_id);
