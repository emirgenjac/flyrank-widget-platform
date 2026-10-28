-- Users belong to one tenant. password_hash is a hash, never the password itself.

ALTER TABLE tenants
  ADD COLUMN name text;

UPDATE tenants
SET name = 'tenant'
WHERE name IS NULL;

ALTER TABLE tenants
  ALTER COLUMN name SET NOT NULL;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_name_length CHECK (char_length(name) BETWEEN 1 AND 80);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format CHECK (
    email = lower(email)
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  CONSTRAINT users_password_hash_present CHECK (char_length(password_hash) > 0)
);

CREATE INDEX users_tenant_id_idx ON users (tenant_id);
