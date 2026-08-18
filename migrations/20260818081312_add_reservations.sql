-- Add migration script here

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


-- RESERVATIONS ENUM & TABLE
create type reservation_status as enum ('pending', 'confirmed', 'cancelled');

create table if not exists reservations (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references groups(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    title text not null,
    description text default null,
    rrule text default null,
    status reservation_status not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz default null
);

create trigger set_reservations_updated_at
before update on reservations
for each row
    execute function update_updated_at_column();

-- Foreign key performance indexes
create index if not exists idx_reservations_group_id on reservations(group_id);
create index if not exists idx_reservations_user_id on reservations(user_id);
create index if not exists idx_reservations_status on reservations(status) where deleted_at is null;


-- OCCURRENCES TABLE
create table if not exists occurrences (
    id uuid primary key default gen_random_uuid(),
    reservation_id uuid not null references reservations(id) on delete cascade,
    resource_id uuid not null references resources(id) on delete cascade,
    start_time timestamptz not null,
    end_time timestamptz not null,
    created_at timestamptz not null default now(),

    constraint chk_occurrence_time_order check (start_time < end_time)
);

-- Foreign key performance indexes
create index if not exists idx_occurrences_reservation_id on occurrences(reservation_id);
create index if not exists idx_occurrences_resource_id on occurrences(resource_id);

-- Composite index optimized for range overlap & conflict checks (start_time/end_time filtering)
create index if not exists idx_occurrences_time_range 
on occurrences(resource_id, start_time, end_time);
