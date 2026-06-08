-- Rollback: remove the per-site owner ad tracking column.
BEGIN;
ALTER TABLE public.sites
  DROP COLUMN IF EXISTS tracking_json;
COMMIT;
