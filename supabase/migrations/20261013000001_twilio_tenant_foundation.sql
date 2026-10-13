-- =============================================================================
-- Phase 2A: Twilio tenant foundation.
--
-- ⚠️  PASTE AND RUN THIS ENTIRE FILE AS ONE QUERY. DO NOT SPLIT IT. ⚠️
--
-- ⚠️  APPLY BEFORE deploying the Phase 2A code. ⚠️
--     The new code reads org_twilio_credentials and filters inbound_numbers on
--     the new provider column. If the code ships first, those queries error and
--     the owner org's number pools come back empty.
--
-- WHY
--   ListHit has two kinds of org: the pinned owner org (GWH), which is the only
--   org that ever uses Telnyx, and every other org, which runs on its own Twilio
--   subaccount. This migration:
--     1. makes org_twilio read-only for tenants (only the server provisions it);
--     2. adds org_twilio_credentials, a service_role-only table holding each
--        org's subaccount SID and its encrypted auth token / API key secret;
--     3. closes the inbound_numbers takeover hole (tenants could insert or
--        delete numbers, or repoint a number at another org) and tags every
--        number with the provider that owns it, so Telnyx and Twilio pools never
--        mix;
--     4. clears a stale phone number from any non-owner org_twilio row that has
--        no subaccount to own it.
--
-- VERIFICATION (run after applying):
--
--   select policyname, cmd from pg_policies where tablename='org_twilio';
--     -- expect only the SELECT policy
--   select policyname, cmd from pg_policies where tablename='inbound_numbers';
--     -- expect SELECT and UPDATE only
--   select count(*) from public.inbound_numbers where provider is null;
--     -- expect 0
--   select relrowsecurity from pg_class where relname='org_twilio_credentials';
--     -- expect true
-- =============================================================================

BEGIN;

-- 1. org_twilio: tenants may READ their own row, never write it.
DROP POLICY IF EXISTS org_twilio_org_insert ON public.org_twilio;
DROP POLICY IF EXISTS org_twilio_org_update ON public.org_twilio;
DROP POLICY IF EXISTS org_twilio_org_delete ON public.org_twilio;
-- (org_twilio_org_select stays.)

-- 2. Per-org Twilio secrets. RLS on, NO policies, no grants: only service_role can touch it.
CREATE TABLE IF NOT EXISTS public.org_twilio_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  subaccount_sid text NOT NULL UNIQUE,
  auth_token_enc text NOT NULL,
  api_key_sid text,
  api_key_secret_enc text,
  twiml_app_sid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_twilio_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_twilio_credentials FROM anon, authenticated;

-- 3. inbound_numbers: tenants can no longer insert or delete numbers (number takeover hole).
DROP POLICY IF EXISTS inbound_numbers_org_insert ON public.inbound_numbers;
DROP POLICY IF EXISTS inbound_numbers_org_delete ON public.inbound_numbers;

-- Provider columns so pools never mix Telnyx and Twilio numbers.
ALTER TABLE public.inbound_numbers ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.inbound_numbers ADD COLUMN IF NOT EXISTS twilio_account_sid text;
ALTER TABLE public.inbound_numbers ADD COLUMN IF NOT EXISTS twilio_phone_number_sid text;
UPDATE public.inbound_numbers SET provider = 'telnyx' WHERE provider IS NULL; -- every existing number came from Telnyx
ALTER TABLE public.inbound_numbers ALTER COLUMN provider SET NOT NULL;
ALTER TABLE public.inbound_numbers DROP CONSTRAINT IF EXISTS inbound_numbers_provider_check;
ALTER TABLE public.inbound_numbers ADD CONSTRAINT inbound_numbers_provider_check
  CHECK (provider IN ('telnyx','twilio'));
CREATE INDEX IF NOT EXISTS idx_inbound_numbers_org_provider ON public.inbound_numbers (org_id, provider);

-- Tenants keep UPDATE (Markets settings edits label/market/voicemail/routing), but identity
-- columns are server-managed. current_user is 'authenticated'/'anon' for PostgREST user
-- requests, 'service_role' for the admin client, and 'postgres' in the SQL editor.
CREATE OR REPLACE FUNCTION public.inbound_numbers_block_identity_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND (
       NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.e164 IS DISTINCT FROM OLD.e164
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.twilio_account_sid IS DISTINCT FROM OLD.twilio_account_sid
    OR NEW.twilio_phone_number_sid IS DISTINCT FROM OLD.twilio_phone_number_sid
  ) THEN
    RAISE EXCEPTION 'inbound_numbers identity columns are managed by ListHit' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inbound_numbers_block_identity_update ON public.inbound_numbers;
CREATE TRIGGER inbound_numbers_block_identity_update
  BEFORE UPDATE ON public.inbound_numbers
  FOR EACH ROW EXECUTE FUNCTION public.inbound_numbers_block_identity_update();

-- 4. Stale data: a non-owner org_twilio row must not claim a phone number it has no
--    subaccount for (Test Co currently points at a Telnyx-era number).
UPDATE public.org_twilio
   SET phone_number = NULL, phone_number_sid = NULL, updated_at = now()
 WHERE subaccount_sid IS NULL
   AND phone_number IS NOT NULL
   AND org_id <> 'adddfd02-790e-4be7-a0df-047b7dbdd1b8';

COMMIT;

-- -----------------------------------------------------------------------------
-- ROLLBACK (run as one query; restores the pre-2A policies and drops the new
-- objects — note this DELETES every stored subaccount credential, and the
-- phone numbers cleared in step 4 are not restored):
--
-- BEGIN;
-- CREATE POLICY org_twilio_org_insert ON public.org_twilio
--     FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
-- CREATE POLICY org_twilio_org_update ON public.org_twilio
--     FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));
-- CREATE POLICY org_twilio_org_delete ON public.org_twilio
--     FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));
-- DROP TABLE IF EXISTS public.org_twilio_credentials;
-- CREATE POLICY inbound_numbers_org_insert ON public.inbound_numbers
--     FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
-- CREATE POLICY inbound_numbers_org_delete ON public.inbound_numbers
--     FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));
-- DROP TRIGGER IF EXISTS inbound_numbers_block_identity_update ON public.inbound_numbers;
-- DROP FUNCTION IF EXISTS public.inbound_numbers_block_identity_update();
-- DROP INDEX IF EXISTS public.idx_inbound_numbers_org_provider;
-- ALTER TABLE public.inbound_numbers DROP CONSTRAINT IF EXISTS inbound_numbers_provider_check;
-- ALTER TABLE public.inbound_numbers DROP COLUMN IF EXISTS twilio_phone_number_sid;
-- ALTER TABLE public.inbound_numbers DROP COLUMN IF EXISTS twilio_account_sid;
-- ALTER TABLE public.inbound_numbers DROP COLUMN IF EXISTS provider;
-- COMMIT;
