-- Add migration script here
ALTER TABLE resources ADD COLUMN reservable_until TIMESTAMPTZ;
