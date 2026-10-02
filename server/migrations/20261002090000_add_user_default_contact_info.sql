-- Default contact information a user can prefill into new reservations.
-- Kept separate from name/email, which identify the account.
ALTER TABLE users ADD COLUMN default_contact_person VARCHAR(255);
ALTER TABLE users ADD COLUMN default_contact_email VARCHAR(255);
ALTER TABLE users ADD COLUMN default_contact_phone VARCHAR(64);
