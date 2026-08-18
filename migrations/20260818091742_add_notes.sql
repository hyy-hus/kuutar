-- Add migration script here

ALTER TABLE reservations ADD COLUMN admin_notes TEXT DEFAULT NULL;
