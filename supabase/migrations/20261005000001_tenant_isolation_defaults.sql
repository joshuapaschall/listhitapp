-- =============================================================================
-- Phase 1B: database-level tenant isolation.
--
-- ⚠️  APPLY ONLY AFTER the Phase 1B code is deployed and live. ⚠️
--     This migration turns "service-role insert forgot org_id" from a silent
--     mis-file into a hard NOT NULL failure. Every service-role writer must
--     already be passing org_id explicitly before this runs.
--
-- WHAT THIS DOES
--   1. 29 tables + tags: org_id DEFAULT changes from the hard-coded GWH uuid to
--      public.auth_org_id().
--   2. 4 server-only messaging tables: the default is dropped outright.
--   3. groups / negative_keywords: global unique constraints become per-org.
--   4. tags gains org_id, per-org uniqueness, and org-scoped RLS.
--
-- WHY
--   33 tables declared `org_id uuid DEFAULT '<GWH uuid>' NOT NULL`, which caused
--   three distinct problems:
--
--   (a) A service-role insert that omitted org_id silently filed the row under
--       GWH — cross-tenant data corruption that no error surfaced.
--   (b) A logged-in non-GWH user's insert that omitted org_id got the GWH
--       default and then failed the RLS `WITH CHECK (org_id = auth_org_id())`.
--       That is why tags, groups, templates, prompts and property-buyer links
--       have been broken for every org except GWH.
--   (c) Some uniqueness was global, not per-org: two orgs could not both have a
--       group named "Cash Buyers", and tags.name was globally unique.
--
--   public.auth_org_id() returns the caller's org for an end-user JWT and NULL
--   for service_role. So end-user inserts become correct automatically, and
--   service-role inserts that forget org_id now fail loudly instead of lying.
--
-- The four default-drops in section 2 subsume the held M1 migration
-- (20260820000001_drop_gwh_org_default_messaging.sql) and are safe to run
-- whether or not M1 was ever applied.
--
-- IDEMPOTENT: safe to re-run (IF EXISTS / IF NOT EXISTS / idempotent DO blocks).
--
-- VERIFICATION (run after applying):
--
--   -- Expect 0 rows (no GWH-uuid defaults left):
--   select table_name from information_schema.columns
--   where table_schema='public' and column_name='org_id' and column_default like '%adddfd02%';
--   -- Expect 30 (29 tables + tags):
--   select count(*) from information_schema.columns
--   where table_schema='public' and column_name='org_id' and column_default like '%auth_org_id%';
--   -- Expect 0 rows (tags all scoped):
--   select count(*) from public.tags where org_id is null;
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Session-aware default. End-user inserts self-scope; service-role inserts
--    that omit org_id now raise NOT NULL instead of landing in GWH.
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_prompts             ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.buyer_consents         ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.buyer_groups           ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.buyer_list_consent     ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.buyers                 ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.calls                  ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.campaign_recipients    ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.campaigns              ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_campaign_content ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_campaign_queue   ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_events           ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_messages         ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_templates        ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.email_threads          ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.gmail_threads          ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.groups                 ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.media_links            ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.negative_keywords      ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.notifications          ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.offers                 ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.properties             ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.property_buyers        ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.property_images        ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.quick_reply_templates  ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.recording_access_log   ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.short_links            ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.showings               ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.sms_templates          ALTER COLUMN org_id SET DEFAULT public.auth_org_id();
ALTER TABLE public.voice_numbers          ALTER COLUMN org_id SET DEFAULT public.auth_org_id();

-- -----------------------------------------------------------------------------
-- 2) Server-only messaging tables. These are never written from a browser
--    session, so a session-aware default would be meaningless — the writer must
--    always name the org. Subsumes the held M1 migration.
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages            ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.message_threads     ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.buyer_sms_senders   ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.sms_campaign_queue  ALTER COLUMN org_id DROP DEFAULT;

-- -----------------------------------------------------------------------------
-- 3) Per-org uniqueness. Two tenants may both have a group called "Cash Buyers".
-- -----------------------------------------------------------------------------
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_name_key;
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS groups_org_name_key ON public.groups (org_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS groups_org_slug_key ON public.groups (org_id, slug) WHERE slug IS NOT NULL;

-- negative_keywords already has negative_keywords_org_keyword_match_unique
-- (org_id, lower(trim(keyword)), match_type), so the global one is redundant.
ALTER TABLE public.negative_keywords DROP CONSTRAINT IF EXISTS negative_keywords_keyword_key;

-- -----------------------------------------------------------------------------
-- 4) tags becomes per-org.
--
--    tags is only the picker vocabulary — the tags actually attached to records
--    live in buyers.tags / properties.tags (text[]). Today it has no org_id, a
--    globally unique name, and `tags_select_all USING (true)`, so every tenant
--    reads every other tenant's vocabulary and nobody but GWH can add to it.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS org_id uuid;

-- Existing vocabulary belongs to the owner org (only GWH has ever written it).
UPDATE public.tags SET org_id = 'adddfd02-790e-4be7-a0df-047b7dbdd1b8' WHERE org_id IS NULL;

ALTER TABLE public.tags ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tags ALTER COLUMN org_id SET DEFAULT public.auth_org_id();

DO $$ BEGIN
  ALTER TABLE public.tags ADD CONSTRAINT tags_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The tag editor inserts { name } only, so color needs a default of its own.
ALTER TABLE public.tags ALTER COLUMN color SET DEFAULT '#3B82F6';

ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS tags_org_name_key ON public.tags (org_id, name);
CREATE INDEX IF NOT EXISTS tags_org_id_idx ON public.tags (org_id);

-- Backfill: give every org a vocabulary row for each tag its buyers/properties
-- already use, so no tenant opens the picker to an empty list.
INSERT INTO public.tags (org_id, name, color)
SELECT DISTINCT s.org_id, s.name, '#3B82F6'
FROM (
  SELECT org_id, unnest(tags) AS name FROM public.buyers WHERE tags IS NOT NULL
  UNION
  SELECT org_id, unnest(tags) AS name FROM public.properties WHERE tags IS NOT NULL
) s
WHERE s.name IS NOT NULL AND btrim(s.name) <> ''
ON CONFLICT (org_id, name) DO NOTHING;

DROP POLICY IF EXISTS tags_select_all ON public.tags;
DROP POLICY IF EXISTS tags_org_select ON public.tags;
DROP POLICY IF EXISTS tags_org_insert ON public.tags;
DROP POLICY IF EXISTS tags_org_update ON public.tags;
DROP POLICY IF EXISTS tags_org_delete ON public.tags;
CREATE POLICY tags_org_select ON public.tags FOR SELECT TO authenticated USING (org_id = public.auth_org_id());
CREATE POLICY tags_org_insert ON public.tags FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id());
CREATE POLICY tags_org_update ON public.tags FOR UPDATE TO authenticated USING (org_id = public.auth_org_id()) WITH CHECK (org_id = public.auth_org_id());
CREATE POLICY tags_org_delete ON public.tags FOR DELETE TO authenticated USING (org_id = public.auth_org_id() AND coalesce(is_protected, false) = false);
-- The existing "service role all on tags" policy is left untouched.

COMMIT;
