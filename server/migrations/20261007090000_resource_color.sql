-- Palette key used to color the resource's events on the calendar; NULL means the default color
ALTER TABLE resources ADD COLUMN color TEXT
    CHECK (color IN ('red', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'blue', 'violet', 'pink'));
