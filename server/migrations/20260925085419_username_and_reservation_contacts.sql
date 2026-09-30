-- 1. Add name to users table
ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';

-- 2. Add contact information fields to reservations
ALTER TABLE reservations ADD COLUMN contact_person VARCHAR(255);
ALTER TABLE reservations ADD COLUMN contact_email VARCHAR(255);
ALTER TABLE reservations ADD COLUMN contact_phone VARCHAR(64);
