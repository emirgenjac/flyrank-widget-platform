-- Submission model from DESIGN.md. A stored row has already passed the honeypot.
-- The row is immutable. Side-effect state, if it needs a column, is a later migration.

CREATE FUNCTION submission_payload_valid(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    jsonb_typeof(payload) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(payload) AS item
      WHERE jsonb_typeof(item.value) <> 'string'
        OR char_length(item.value #>> '{}') < 1
        OR char_length(item.value #>> '{}') > 500
        OR item.key !~ '^[a-z0-9_]{1,40}$'
        OR item.key = 'company_website'
    );
$$;

CREATE FUNCTION submission_geo_valid(geo jsonb, geo_provider text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN geo IS NULL AND geo_provider IS NULL THEN true
      WHEN geo IS NULL OR geo_provider IS NULL THEN false
      ELSE
        geo_provider IN ('ip-api.com', 'ipapi.co')
        AND jsonb_typeof(geo) = 'object'
        AND (geo - 'country_code' - 'country' - 'city') = '{}'::jsonb
        AND geo ? 'country_code'
        AND geo ? 'country'
        AND geo ? 'city'
        AND geo->>'country_code' ~ '^[A-Za-z]{2}$'
        AND char_length(geo->>'country') BETWEEN 1 AND 80
        AND (
          jsonb_typeof(geo->'city') = 'null'
          OR (
            jsonb_typeof(geo->'city') = 'string'
            AND char_length(geo->>'city') BETWEEN 1 AND 80
          )
        )
    END;
$$;

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES widgets (id),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  payload jsonb NOT NULL,
  client_ip inet NOT NULL,
  geo jsonb,
  geo_provider text,
  honeypot_result text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submissions_payload_valid CHECK (submission_payload_valid(payload)),
  CONSTRAINT submissions_geo_valid CHECK (submission_geo_valid(geo, geo_provider)),
  CONSTRAINT submissions_honeypot_pass CHECK (honeypot_result = 'pass')
);

CREATE INDEX submissions_widget_created_at_idx ON submissions (widget_id, created_at);
CREATE INDEX submissions_tenant_id_idx ON submissions (tenant_id);

CREATE FUNCTION submissions_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT tenant_id INTO owner FROM widgets WHERE id = NEW.widget_id;
  IF owner IS NULL OR NEW.tenant_id IS DISTINCT FROM owner THEN
    RAISE EXCEPTION 'tenant_id must match the widget';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER submissions_before_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION submissions_before_insert();

CREATE FUNCTION submissions_reject_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'submissions are immutable';
END;
$$;

CREATE TRIGGER submissions_reject_update
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION submissions_reject_update();
