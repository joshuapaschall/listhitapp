BEGIN;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS shorten_links boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.campaigns.shorten_links IS
  'When true (default), http(s) URLs in SMS bodies are replaced with tracked short links at send time. When false, raw URLs are sent and no click tracking occurs.';

COMMIT;
