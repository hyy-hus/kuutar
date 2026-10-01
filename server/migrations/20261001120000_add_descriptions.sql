-- Localized rich-text descriptions stored as Tiptap JSON documents per language,
-- e.g. {"fi": {"type": "doc", "content": [...]}, "en": {...}}
ALTER TABLE collections ADD COLUMN description JSONB;
ALTER TABLE groups ADD COLUMN description JSONB;
ALTER TABLE resources ADD COLUMN description JSONB;
