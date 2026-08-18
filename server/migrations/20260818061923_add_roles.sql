-- Add migration script here

CREATE TYPE user_role AS ENUM ('admin', 'user');

ALTER TABLE users 
ADD COLUMN role user_role NOT NULL DEFAULT 'user';
