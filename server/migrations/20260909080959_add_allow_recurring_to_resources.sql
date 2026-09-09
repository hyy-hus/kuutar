-- Add migration script here

ALTER TABLE resources 
ADD COLUMN allow_recurring BOOLEAN NOT NULL DEFAULT false;
