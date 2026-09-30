-- Add migration script here
-- Add is_public boolean flag to resources table (defaults to true for existing resources)
ALTER TABLE resources ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
