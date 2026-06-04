-- ============ PROPERTY SLUGS ============
ALTER TABLE properties ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS properties_slug_idx ON properties (slug) WHERE slug IS NOT NULL;

-- Base slug generator
CREATE OR REPLACE FUNCTION generate_property_slug_base(
  p_address text, p_city text, p_state text, p_zip text
) RETURNS text AS $$
DECLARE base_slug text;
BEGIN
  base_slug := lower(
    coalesce(p_address, '') || '-' ||
    coalesce(p_city, '') || '-' ||
    coalesce(p_state, '') || '-' ||
    coalesce(p_zip, '')
  );
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Unique slug generator (handles collisions)
CREATE OR REPLACE FUNCTION generate_property_slug_unique(
  p_property_id uuid, p_address text, p_city text, p_state text, p_zip text
) RETURNS text AS $$
DECLARE base_slug text; candidate text; suffix int := 0;
BEGIN
  base_slug := generate_property_slug_base(p_address, p_city, p_state, p_zip);
  IF base_slug = '' THEN RETURN p_property_id::text; END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM properties WHERE slug = candidate AND id <> p_property_id) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- Trigger function
CREATE OR REPLACE FUNCTION set_property_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR (
    TG_OP = 'UPDATE' AND (
      OLD.address IS DISTINCT FROM NEW.address OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.state IS DISTINCT FROM NEW.state OR
      OLD.zip IS DISTINCT FROM NEW.zip
    )
  ) THEN
    NEW.slug := generate_property_slug_unique(NEW.id, NEW.address, NEW.city, NEW.state, NEW.zip);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_property_slug ON properties;
CREATE TRIGGER trg_set_property_slug
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_property_slug();

-- Backfill existing rows
UPDATE properties
SET slug = generate_property_slug_unique(id, address, city, state, zip)
WHERE slug IS NULL;

-- ============ TCPA CONSENT AUDIT LOG ============
CREATE TABLE IF NOT EXISTS buyer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'website_signup',
  source_url text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buyer_consents_buyer_id_idx ON buyer_consents (buyer_id);
CREATE INDEX IF NOT EXISTS buyer_consents_consent_at_idx ON buyer_consents (consent_at DESC);

ALTER TABLE buyer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role all on buyer_consents" ON buyer_consents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read buyer_consents" ON buyer_consents
  FOR SELECT TO authenticated USING (true);
