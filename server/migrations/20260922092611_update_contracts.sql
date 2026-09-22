-- Add migration script here

-- Clean up existing table
TRUNCATE TABLE contracts CASCADE;

-- Re-structure contracts for localized JSONB fields
ALTER TABLE contracts
    DROP COLUMN body,
    ADD COLUMN title JSONB NOT NULL,       -- e.g. {"fi": "Säännöt", "en": "Rules"}
    ADD COLUMN s3_key JSONB NOT NULL,      -- e.g. {"fi": "docs/saannot.pdf", "en": "docs/rules.pdf"}
    ADD COLUMN file_name JSONB NOT NULL,   -- e.g. {"fi": "saannot.pdf", "en": "rules.pdf"}
    ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Join table for Resource <-> Contract Many-to-Many
CREATE TABLE resource_contracts (
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource_id, contract_id)
);

CREATE INDEX idx_resource_contracts_resource ON resource_contracts(resource_id);
CREATE INDEX idx_resource_contracts_contract ON resource_contracts(contract_id);
