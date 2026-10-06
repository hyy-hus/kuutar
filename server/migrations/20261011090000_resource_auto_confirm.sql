-- Resources flagged `auto_confirm` confirm non-admin reservations immediately instead of
-- leaving them pending for admin approval. When `resource_auto_confirm_groups` has rows for
-- the resource, only members of those groups are auto-confirmed; with no rows everyone is.
ALTER TABLE resources ADD COLUMN auto_confirm BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE resource_auto_confirm_groups (
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource_id, group_id)
);

CREATE INDEX idx_resource_auto_confirm_groups_group ON resource_auto_confirm_groups (group_id);
