-- =============================================================================
-- Settings → Tags, part 2: make the tags table server-write-only.
--
-- ⚠️  PASTE AND RUN THIS ENTIRE FILE AS ONE QUERY. DO NOT SPLIT IT. ⚠️
--
-- ⚠️  APPLY ONLY AFTER the Settings → Tags code is deployed and live. ⚠️
--     Until then the old browser code (TagSelector, the CSV importer) still
--     inserts into public.tags directly with the session client. Dropping these
--     policies first would break tag creation in the UI.
--
-- WHY
--   Every tag write now goes through /api/tags*, which calls ensureTagsExist or
--   one of the SECURITY DEFINER cascade functions via supabaseAdmin. Leaving the
--   end-user INSERT/UPDATE/DELETE policies in place would let a logged-in user
--   bypass the cascade — renaming a tag row directly, for instance, orphaning
--   every buyers.tags / properties.tags / segment reference to the old name.
--
--   tags_org_select stays (the pickers read it) and so does the service_role
--   policy (the API routes write through it).
--
-- VERIFICATION (run after applying) — expect exactly 2 rows, the SELECT policy
-- and the service-role policy:
--
--   select policyname, cmd from pg_policies where tablename='tags';
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tags_org_insert ON public.tags;
DROP POLICY IF EXISTS tags_org_update ON public.tags;
DROP POLICY IF EXISTS tags_org_delete ON public.tags;

COMMIT;
