-- T2: Secondary Customer Profile provisioning state for org_twilio, plus the
-- business_type field needed for Twilio TrustHub registration. RLS for
-- org_twilio already exists (T1) and is not recreated here.
BEGIN;

ALTER TABLE public.org_twilio
  ADD COLUMN IF NOT EXISTS customer_profile_status text,        -- mirrors Twilio CP status: draft|pending-review|in-review|twilio-approved|twilio-rejected
  ADD COLUMN IF NOT EXISTS provisioning_state jsonb NOT NULL DEFAULT '{}'::jsonb, -- intermediate Twilio resource SIDs + flags for idempotent resume
  ADD COLUMN IF NOT EXISTS provisioning_error text;             -- last human-readable failure reason, null when healthy

ALTER TABLE public.business_verification
  ADD COLUMN IF NOT EXISTS business_type text,                  -- Twilio legal-structure enum; null => default 'Limited Liability Corporation' at provisioning
  ADD COLUMN IF NOT EXISTS business_registration_identifier text DEFAULT 'EIN';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.org_twilio
--   DROP COLUMN IF EXISTS customer_profile_status,
--   DROP COLUMN IF EXISTS provisioning_state,
--   DROP COLUMN IF EXISTS provisioning_error;
-- ALTER TABLE public.business_verification
--   DROP COLUMN IF EXISTS business_type,
--   DROP COLUMN IF EXISTS business_registration_identifier;
-- COMMIT;
