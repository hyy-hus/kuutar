-- Per-resource booking durations in minutes. `default_duration_minutes` pre-fills the end
-- time when a slot is picked; min/max are enforced for non-admins. NULL means no setting.
ALTER TABLE resources
    ADD COLUMN default_duration_minutes INTEGER CHECK (default_duration_minutes > 0),
    ADD COLUMN min_duration_minutes INTEGER CHECK (min_duration_minutes > 0),
    ADD COLUMN max_duration_minutes INTEGER CHECK (max_duration_minutes > 0),
    ADD CONSTRAINT resources_duration_order CHECK (
        (min_duration_minutes IS NULL OR max_duration_minutes IS NULL OR min_duration_minutes <= max_duration_minutes)
        AND (default_duration_minutes IS NULL OR min_duration_minutes IS NULL OR default_duration_minutes >= min_duration_minutes)
        AND (default_duration_minutes IS NULL OR max_duration_minutes IS NULL OR default_duration_minutes <= max_duration_minutes)
    );
