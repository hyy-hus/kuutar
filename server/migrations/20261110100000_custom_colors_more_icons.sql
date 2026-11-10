-- Resources may use any custom color, stored as a lowercase #rrggbb value, besides the
-- palette keys. Collections get icons for more kinds of spaces. Both only relax the existing
-- CHECK constraints, so existing rows stay valid.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND ((conrelid = 'resources'::regclass AND pg_get_constraintdef(oid) LIKE '%color%')
            OR (conrelid = 'collections'::regclass AND pg_get_constraintdef(oid) LIKE '%icon%'))
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;
END $$;

ALTER TABLE resources ADD CONSTRAINT resources_color_check
    CHECK (color IN ('red', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'blue', 'violet', 'pink')
           OR color ~ '^#[0-9a-f]{6}$');

ALTER TABLE collections ADD CONSTRAINT collections_icon_check
    CHECK (icon IN (
        'layers', 'wrench', 'car', 'home', 'projector', 'camera', 'music',
        'utensils', 'bike', 'tent', 'users', 'monitor', 'mic', 'book',
        'gamepad', 'palette', 'hammer', 'truck', 'sofa', 'trees',
        'dumbbell', 'laptop', 'printer', 'shirt',
        'party', 'disco', 'cinema', 'theater', 'reading', 'library', 'computer',
        'office', 'building', 'lecture', 'classroom', 'meeting', 'lab', 'coffee'
    ));
