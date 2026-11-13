-- News items: localized title and blurb (plain strings per language), localized rich-text body
-- (Tiptap JSON per language, like resource descriptions), visibility, scheduled publishing and
-- home page highlights. Additive only.
CREATE TYPE news_visibility AS ENUM ('public', 'users', 'groups');

CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- {"fi": "...", "sv": "...", "en": "..."}
    title JSONB NOT NULL,
    blurb JSONB NOT NULL DEFAULT '{}',
    -- {"fi": {"type": "doc", ...}, ...}
    body JSONB,
    -- public: everyone, guests included; users: signed-in users; groups: members of the groups in
    -- news_visibility_groups. Admins see everything.
    visibility news_visibility NOT NULL DEFAULT 'users',
    -- NULL = draft; a future time keeps the item hidden from non-admins until then
    published_at TIMESTAMPTZ,
    highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    -- Highlight ends at this time; NULL = until removed
    highlight_until TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_news_updated_at
BEFORE UPDATE ON news
FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_news_published_at ON news (published_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE news_visibility_groups (
    news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, group_id)
);

CREATE INDEX idx_news_visibility_groups_group ON news_visibility_groups (group_id);

-- Which signed-in users have read which items. Guests are not tracked.
CREATE TABLE news_reads (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, news_id)
);

CREATE INDEX idx_news_reads_news ON news_reads (news_id);
