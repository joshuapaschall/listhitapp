-- Rollback: remove the page on/off model columns from site_pages.
BEGIN;
ALTER TABLE public.site_pages
  DROP COLUMN IF EXISTS enabled,
  DROP COLUMN IF EXISTS nav_label,
  DROP COLUMN IF EXISTS sort_order;
COMMIT;
