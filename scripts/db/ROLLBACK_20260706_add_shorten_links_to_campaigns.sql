BEGIN;

ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS shorten_links;

COMMIT;
