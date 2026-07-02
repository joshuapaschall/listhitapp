-- T4: separate voice_provider, Telnyx-safe defaults, campaign status, GWH correction.
BEGIN;

-- voice_provider mirrors sms_provider (separate rails, both default telnyx = fail-safe).
ALTER TABLE public.org_twilio
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'telnyx',
  ADD COLUMN IF NOT EXISTS campaign_status text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_twilio_voice_provider_check') THEN
    ALTER TABLE public.org_twilio
      ADD CONSTRAINT org_twilio_voice_provider_check CHECK (voice_provider = ANY (ARRAY['telnyx','twilio']));
  END IF;
END $$;

-- Fail-safe default: new orgs are telnyx until they explicitly opt in AND go live.
ALTER TABLE public.org_twilio ALTER COLUMN sms_provider SET DEFAULT 'telnyx';

-- Correct the owner's (GWH) stray 'twilio' value from testing. The env pin is the real
-- guarantee, but defaults should be clean too.
UPDATE public.org_twilio
  SET sms_provider = 'telnyx'
  WHERE org_id = 'adddfd02-790e-4be7-a0df-047b7dbdd1b8' AND sms_provider = 'twilio';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.org_twilio ALTER COLUMN sms_provider SET DEFAULT 'twilio';
-- ALTER TABLE public.org_twilio DROP CONSTRAINT IF EXISTS org_twilio_voice_provider_check;
-- ALTER TABLE public.org_twilio DROP COLUMN IF EXISTS voice_provider, DROP COLUMN IF EXISTS campaign_status;
-- COMMIT;
