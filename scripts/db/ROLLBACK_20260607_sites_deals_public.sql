-- Rollback: remove the public property pages flag.
BEGIN;
ALTER TABLE public.sites
  DROP COLUMN IF EXISTS deals_public;
COMMIT;
