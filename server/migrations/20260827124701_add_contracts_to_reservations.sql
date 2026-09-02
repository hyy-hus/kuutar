-- Add migration script here

ALTER TABLE reservations
ADD COLUMN contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
ADD COLUMN contract_printed_at TIMESTAMPTZ DEFAULT NULL;
