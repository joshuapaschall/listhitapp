-- Public property pages flag for tenant sites.
-- When true (the default), individual property pages are public/indexable and the
-- /properties list shows full cards linking to them. When false, the list stays
-- gated (locked teaser + signup) and individual property detail pages 404.
-- Idempotent — safe to re-run.
BEGIN;
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS deals_public boolean NOT NULL DEFAULT true;
COMMIT;
