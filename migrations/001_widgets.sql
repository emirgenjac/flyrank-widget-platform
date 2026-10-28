-- Widget model from DESIGN.md. Tenants exist here so widgets.tenant_id
-- has a real foreign key. Submissions are in 002. Users are in 003.

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION widget_fields_valid(widget_type text, fields jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    jsonb_typeof(fields) = 'array'
    AND jsonb_array_length(fields) <= 8
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(fields) AS elem
      WHERE jsonb_typeof(elem) <> 'object'
        OR elem->>'name' IS NULL
        OR elem->>'name' !~ '^[a-z0-9_]{1,40}$'
        OR elem->>'name' = 'company_website'
        OR char_length(coalesce(elem->>'label', '')) < 1
        OR char_length(elem->>'label') > 80
        OR coalesce(elem->>'input_type', '') NOT IN ('email', 'text', 'tel')
        OR jsonb_typeof(elem->'required') IS DISTINCT FROM 'boolean'
    )
    AND (
      SELECT count(*) = count(DISTINCT elem->>'name')
      FROM jsonb_array_elements(fields) AS elem
    )
    AND (
      widget_type <> 'signup'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(fields) AS elem
        WHERE elem->>'input_type' = 'email'
      )
    );
$$;

CREATE TABLE widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  button_text text NOT NULL,
  display_options jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT widgets_public_id_format CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
  CONSTRAINT widgets_type_known CHECK (type IN ('signup', 'cta', 'popover')),
  CONSTRAINT widgets_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT widgets_description_length CHECK (
    description IS NULL OR char_length(description) BETWEEN 1 AND 500
  ),
  CONSTRAINT widgets_button_text_length CHECK (char_length(button_text) BETWEEN 1 AND 40),
  CONSTRAINT widgets_fields_valid CHECK (widget_fields_valid(type, fields)),
  CONSTRAINT widgets_display_options_valid CHECK (
    jsonb_typeof(display_options) = 'object'
    AND display_options->>'placement' IN ('inline', 'bottom-right', 'center')
    AND display_options->>'theme' IN ('light', 'dark')
    AND (display_options - 'placement' - 'theme') = '{}'::jsonb
  )
);

CREATE INDEX widgets_tenant_id_idx ON widgets (tenant_id);

CREATE FUNCTION widgets_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id is immutable';
  END IF;
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'public_id is immutable';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER widgets_before_update
  BEFORE UPDATE ON widgets
  FOR EACH ROW
  EXECUTE FUNCTION widgets_before_update();
