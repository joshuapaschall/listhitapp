-- Twilio A2P campaigns accept 2–5 sample messages. Samples 1–2 stay required;
-- 3–5 are optional and improve TCR review outcomes.
BEGIN;

ALTER TABLE public.a2p_registration
  ADD COLUMN IF NOT EXISTS sample_message_3 text,
  ADD COLUMN IF NOT EXISTS sample_message_4 text,
  ADD COLUMN IF NOT EXISTS sample_message_5 text;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.a2p_registration
--   DROP COLUMN IF EXISTS sample_message_3,
--   DROP COLUMN IF EXISTS sample_message_4,
--   DROP COLUMN IF EXISTS sample_message_5;
-- COMMIT;
