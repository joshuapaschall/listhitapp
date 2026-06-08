-- Rollback: remove the Listings v2 columns.
BEGIN;
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS show_on_site,
  DROP COLUMN IF EXISTS internal_notes,
  DROP COLUMN IF EXISTS photo_album_url,
  DROP COLUMN IF EXISTS year_built,
  DROP COLUMN IF EXISTS lot_size,
  DROP COLUMN IF EXISTS mls_number,
  DROP COLUMN IF EXISTS construction_type;
COMMIT;
