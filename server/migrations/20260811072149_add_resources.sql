-- enable UUID extension
create extension if not exists "uuid-ossp";

-- create a function for setting updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;


-- 1. COLLECTIONS TABLE
create table if not exists collections (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz default null
);

create trigger set_collection_updated_at
before update on collections
for each row
    execute function update_updated_at_column();

-- Enforce unique active collection names
create unique index idx_collections_unique_active_name
on collections(name)
where deleted_at is null;


-- 2. RESOURCES TABLE
create table if not exists resources (
    id uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz default null
);

create trigger set_resources_updated_at
before update on resources
for each row
    execute function update_updated_at_column();

-- Foreign key performance index (speeds up joins and CASCADE checks)
create index if not exists idx_resources_collection_id on resources(collection_id);

-- Enforce unique resource names within a collection among active resources
-- ALSO doubles as the active collection lookups index!
create unique index idx_resources_unique_active_name_per_collection
on resources(collection_id, name)
where deleted_at is null;
