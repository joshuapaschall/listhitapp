-- C1a: conference-based outbound calls. Room name + Twilio conference SID per call.
BEGIN;
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS conference_name text,
  ADD COLUMN IF NOT EXISTS conference_sid text;
COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.calls DROP COLUMN IF EXISTS conference_name, DROP COLUMN IF EXISTS conference_sid;
-- COMMIT;
