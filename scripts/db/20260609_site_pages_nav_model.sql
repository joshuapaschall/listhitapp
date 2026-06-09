-- Page on/off model for tenant sites: per-page enable flag, optional nav label,
-- and sort order. The published-site nav links for enabled, nav-labeled pages
-- are injected at render time (lib/site-builder/resolve-site.ts#getNavPages /
-- injectPageNavLinks). Existing rows default to enabled=true, nav_label=null,
-- sort_order=0. Idempotent — safe to re-run.
BEGIN;
ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS enabled    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nav_label  text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
COMMIT;
