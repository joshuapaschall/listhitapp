-- V1a: distinguish voice rails in the call log. All existing rows are Telnyx.
BEGIN;

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'telnyx';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calls_provider_check') THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_provider_check CHECK (provider = ANY (ARRAY['telnyx','twilio']));
  END IF;
END $$;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_provider_check;
-- ALTER TABLE public.calls DROP COLUMN IF EXISTS provider;
-- COMMIT;
