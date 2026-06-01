BEGIN;

ALTER TABLE public.buyers
  ADD COLUMN IF NOT EXISTS email_suppressed boolean NOT NULL DEFAULT false;

UPDATE public.buyers
SET email_suppressed = true
WHERE sendfox_suppressed = true
  AND email_suppressed = false;

COMMIT;
