-- Migration: drop legacy name column from contracts table
ALTER TABLE contracts DROP COLUMN IF EXISTS name;
