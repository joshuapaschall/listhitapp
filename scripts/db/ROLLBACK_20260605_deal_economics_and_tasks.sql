-- Roll back deal economics foundations and task records.

BEGIN;

DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.dispositions;

DROP INDEX IF EXISTS public.campaigns_property_id_idx;

ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE public.offers
  DROP COLUMN IF EXISTS accepted_price,
  DROP COLUMN IF EXISTS assignment_fee,
  DROP COLUMN IF EXISTS deal_expenses,
  DROP COLUMN IF EXISTS countered_at;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS buy_price;

COMMIT;
