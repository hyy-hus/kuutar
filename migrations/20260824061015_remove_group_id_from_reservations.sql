-- Add migration script here
DROP INDEX IF EXISTS idx_reservations_group_id;

ALTER TABLE reservations
  DROP COLUMN IF EXISTS group_id;
