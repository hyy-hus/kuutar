-- Optional icon for a collection: a key from a curated allowlist that the
-- client maps to an icon component. NULL means the default icon.
ALTER TABLE collections
    ADD COLUMN icon TEXT
    CHECK (icon IN (
        'layers', 'wrench', 'car', 'home', 'projector', 'camera', 'music',
        'utensils', 'bike', 'tent', 'users', 'monitor', 'mic', 'book',
        'gamepad', 'palette', 'hammer', 'truck', 'sofa', 'trees',
        'dumbbell', 'laptop', 'printer', 'shirt'
    ));
