-- Per-site owner ad tracking. Holds the site owner's OWN ad tags so their PPC
-- fires conversions in their own ad accounts (separate from ListHit's
-- first-party analytics). Shape: { ga4_id, google_ads_id, google_ads_label,
-- meta_pixel_id }. Idempotent — safe to re-run.
BEGIN;
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS tracking_json jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
