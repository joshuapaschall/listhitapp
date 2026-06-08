-- Listings v2 data model.
-- show_on_site defaults true so existing available properties stay visible on
-- published sites. `description` remains the PUBLIC listing copy; `internal_notes`
-- is private (the editor stops writing notes into description going forward).
-- The remaining columns are optional listing facts. Idempotent — safe to re-run.
BEGIN;
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS show_on_site boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS photo_album_url text,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS lot_size text,
  ADD COLUMN IF NOT EXISTS mls_number text,
  ADD COLUMN IF NOT EXISTS construction_type text;
COMMIT;
