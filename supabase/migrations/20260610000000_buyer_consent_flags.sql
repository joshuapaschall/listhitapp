BEGIN;
ALTER TABLE public.buyer_consents
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nonmarketing_consent boolean NOT NULL DEFAULT false;
COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.buyer_consents
--   DROP COLUMN IF EXISTS marketing_consent,
--   DROP COLUMN IF EXISTS nonmarketing_consent;
-- COMMIT;
