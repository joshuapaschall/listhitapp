BEGIN;

UPDATE public.buyers
SET deleted_at = COALESCE(deleted_at, now())
WHERE sendfox_hidden = true
  AND deleted_at IS NULL;

COMMIT;
