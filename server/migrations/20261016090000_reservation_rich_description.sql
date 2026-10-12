-- Reservation descriptions become localized rich text (Tiptap JSON per language, like resources),
-- and reservers get a private message field for the admins.
--
-- Additive only: the plain-text `description` column is intentionally left in place as a backup
-- of the legacy values. Drop it in a later migration once the backfill has been verified.
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS description_rich JSONB,
    ADD COLUMN IF NOT EXISTS message_to_admins TEXT;

-- Legacy text becomes one paragraph per non-empty line under "fi". Clients fall back to any
-- available language, so the text shows up in every locale.
UPDATE reservations r
SET description_rich = jsonb_build_object(
    'fi',
    jsonb_build_object(
        'type', 'doc',
        'content', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'type', 'paragraph',
                    'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', line))
                )
                ORDER BY ord
            )
            FROM regexp_split_to_table(r.description, E'\r?\n') WITH ORDINALITY AS t(raw, ord),
                 LATERAL (SELECT btrim(raw) AS line) l
            WHERE line <> ''
        )
    )
)
WHERE r.description_rich IS NULL
  AND r.description IS NOT NULL
  AND btrim(r.description) <> '';
