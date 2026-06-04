-- Roll back the segments table and the campaigns audience columns.

BEGIN;

DROP INDEX IF EXISTS public.campaigns_segment_id_idx;

ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS segment_id,
  DROP COLUMN IF EXISTS audience_definition,
  DROP COLUMN IF EXISTS audience_preview_count;

DROP TABLE IF EXISTS public.segments;

COMMIT;
