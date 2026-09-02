-- CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    body JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER set_contracts_updated_at
BEFORE UPDATE ON contracts
FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enforce unique active contract names
CREATE UNIQUE INDEX idx_contracts_unique_active_name
ON contracts(name)
WHERE deleted_at IS NULL;
