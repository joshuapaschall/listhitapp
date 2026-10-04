-- =============================================================================
-- Phase 0 "Lock the Doors": remove end-user write access to privilege-bearing
-- tables (profiles, organizations, permissions).
--
-- WHAT THIS DOES
--   1. Drops the RLS UPDATE/INSERT policies granted to `authenticated` on
--      public.profiles, public.organizations and public.permissions.
--   2. Adds a BEFORE UPDATE trigger on public.profiles that rejects changes to
--      the privilege-bearing columns (role, org_id, sip_username, sip_password,
--      telnyx_credential_id) whenever the statement runs under an end-user JWT.
--
-- WHY
--   Every legitimate write to these three tables already goes through
--   supabaseAdmin (service role), so the `authenticated` write policies are
--   unused by the app. What they DID allow was privilege escalation: any logged
--   in user could `update profiles set role = 'owner', org_id = '<any org>'
--   where id = auth.uid()`, or insert themselves a permissions row, and thereby
--   take over any tenant. The trigger is defense in depth in case a future
--   policy re-opens UPDATE on profiles.
--
--   Policies deliberately left in place:
--     "Profiles are viewable by owner"
--     "Profiles can be inserted by auth service"   (supabase_auth_admin)
--     "Profiles can be inserted by service role"
--     organizations_org_select
--     "Users can view their permissions"
--     every service_role policy
--
-- IDEMPOTENT: safe to re-run (DROP POLICY IF EXISTS / CREATE OR REPLACE /
-- DROP TRIGGER IF EXISTS).
--
-- VERIFICATION (run after applying):
--
--   -- Expect 0 rows:
--   select policyname from pg_policies where schemaname='public'
--     and tablename in ('profiles','organizations','permissions')
--     and cmd in ('UPDATE','INSERT','ALL') and 'authenticated' = any(roles);
--   -- Expect 1 row:
--   select tgname from pg_trigger where tgname='profiles_block_privileged_self_update';
-- =============================================================================

-- 1) Drop the end-user write policies on privilege-bearing tables.
DROP POLICY IF EXISTS "Profiles can be updated by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be inserted by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be inserted by self" ON public.profiles;
DROP POLICY IF EXISTS organizations_org_update ON public.organizations;
DROP POLICY IF EXISTS permissions_user_all ON public.permissions;

-- 2) Defense in depth: reject privileged column changes made under an end-user JWT.
CREATE OR REPLACE FUNCTION public.profiles_block_privileged_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- auth.uid() is NULL for service_role, postgres and the SQL editor: allowed.
  IF auth.uid() IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.org_id IS DISTINCT FROM OLD.org_id
       OR NEW.sip_username IS DISTINCT FROM OLD.sip_username
       OR NEW.sip_password IS DISTINCT FROM OLD.sip_password
       OR NEW.telnyx_credential_id IS DISTINCT FROM OLD.telnyx_credential_id THEN
      RAISE EXCEPTION 'privileged profile columns can only be changed by the server' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_privileged_self_update ON public.profiles;
CREATE TRIGGER profiles_block_privileged_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_privileged_self_update();
