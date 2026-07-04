-- V3d: capture the Twilio far-party (child) leg SID for cold transfer.
BEGIN;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS far_leg_sid text;
COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.calls DROP COLUMN IF EXISTS far_leg_sid;
-- COMMIT;
