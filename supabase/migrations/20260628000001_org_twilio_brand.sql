-- T3a: TrustProduct + Brand registration columns on org_twilio.
BEGIN;

ALTER TABLE public.org_twilio
  ADD COLUMN IF NOT EXISTS trust_product_sid text,     -- BU... A2P TrustProduct (compliance container)
  ADD COLUMN IF NOT EXISTS brand_status text;          -- mirrors Twilio BrandRegistration status: PENDING|APPROVED|FAILED|IN_REVIEW|...

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.org_twilio
--   DROP COLUMN IF EXISTS trust_product_sid,
--   DROP COLUMN IF EXISTS brand_status;
-- COMMIT;
