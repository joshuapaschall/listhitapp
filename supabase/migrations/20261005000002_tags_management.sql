-- =============================================================================
-- Settings → Tags: org tag management with a full cascade.
--
-- ⚠️  PASTE AND RUN THIS ENTIRE FILE AS ONE QUERY. DO NOT SPLIT IT. ⚠️
--     It is a single transaction with a self-test at the end. Running it in
--     pieces can leave the helper function defined but untested, or the seed
--     applied without the protection flags.
--
-- This migration is ADDITIVE and safe to apply BEFORE the code is deployed.
-- (The companion lockdown migration, 20261005000003_tags_lockdown.sql, must be
-- applied AFTER the deploy — until then the old browser code still inserts
-- tags directly.)
--
-- WHAT THIS DOES
--   1. Seeds the 20 system tags into every org and marks them is_protected.
--   2. Adds public.tag_rewrite_definition() — a pure, IMMUTABLE helper that
--      rewrites a segment/audience jsonb definition for a tag rename or delete.
--   3. Adds four SECURITY DEFINER cascade functions (tag_usage, tag_rename,
--      tag_merge, tag_delete), executable by service_role ONLY.
--
-- WHY A CASCADE
--   Tags are stored by NAME, not by id, in four places:
--     buyers.tags text[], properties.tags text[],
--     segments.definition jsonb, campaigns.audience_definition jsonb.
--   A rename/merge/delete therefore has to rewrite all four, atomically, or the
--   vocabulary and the data drift apart and filters silently return nothing.
--
-- WHY SERVICE-ROLE ONLY
--   These functions take p_org_id explicitly and bypass RLS. They are called
--   from API routes through supabaseAdmin only AFTER the route has verified the
--   session and the settings.tags permission. An end-user JWT must never be
--   able to invoke them directly with somebody else's org id.
--
-- VERIFICATION (run after applying):
--
--   -- Expect 20 protected rows per org:
--   select org_id, count(*) filter (where is_protected) from public.tags group by org_id;
--   -- Expect 5 functions:
--   select proname from pg_proc where proname in ('tag_usage','tag_rename','tag_merge','tag_delete','tag_rewrite_definition');
--   -- Expect false (authenticated cannot call the cascade):
--   select has_function_privilege('authenticated', 'public.tag_delete(uuid,uuid)', 'execute');
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) System tags: names the application code hard-codes (lib/buyer-taxonomy.ts
--    PERSONA_BASE_TAGS / BUYER_TYPE_MAP / PAYMENT_MAP, applied by website
--    signups). They must exist in every org and can never be renamed or
--    deleted. Recoloring is fine.
--
--    This array MUST stay identical to SYSTEM_TAGS in lib/tags/system-tags.ts.
--    tests/system-tags-parity.test.ts parses this file and enforces it.
-- -----------------------------------------------------------------------------
INSERT INTO public.tags (org_id, name, color, is_protected)
SELECT o.id, s.name, '#3B82F6', true
FROM public.organizations o
CROSS JOIN unnest(ARRAY[
  'Agent','Buy and Hold','Cash Buyer','Commercial','Creative Finance','Developer/Home Builder',
  'First-time Buyer','Fix and Flips','Fixer Upper','Hard Money','Investor','Land Development',
  'Landlord','New Construction','Owner Financing','Realtor','Rent to Own','Retail Buyer','SUB2','Wholesaler'
]) AS s(name)
ON CONFLICT (org_id, name) DO UPDATE SET is_protected = true;

-- "Protected" means exactly one thing: code depends on this name. Anything else
-- previously flagged protected becomes an ordinary custom tag.
UPDATE public.tags SET is_protected = false
WHERE is_protected AND name <> ALL (ARRAY[
  'Agent','Buy and Hold','Cash Buyer','Commercial','Creative Finance','Developer/Home Builder',
  'First-time Buyer','Fix and Flips','Fixer Upper','Hard Money','Investor','Land Development',
  'Landlord','New Construction','Owner Financing','Realtor','Rent to Own','Retail Buyer','SUB2','Wholesaler'
]);

-- -----------------------------------------------------------------------------
-- 2) Pure rewrite helper for segment / campaign-audience definitions.
--
--    Pass new_name = NULL to delete the tag from the rules. A tags condition
--    whose value list becomes empty is DROPPED for the set operators
--    (contains / contains_all / not_contains), because an empty list would
--    otherwise change the rule's meaning rather than remove it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tag_rewrite_definition(def jsonb, old_name text, new_name text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  conds      jsonb;
  cond       jsonb;
  out_conds  jsonb := '[]'::jsonb;
  vals       jsonb;
  new_vals   jsonb;
  elem       text;
  op         text;
  seen       text[];
BEGIN
  IF def IS NULL THEN
    RETURN def;
  END IF;

  conds := def -> 'conditions';
  IF conds IS NULL OR jsonb_typeof(conds) <> 'array' THEN
    RETURN def;
  END IF;

  FOR cond IN SELECT value FROM jsonb_array_elements(conds) LOOP
    vals := cond -> 'value';

    IF cond ->> 'kind' = 'attribute'
       AND cond ->> 'field' = 'tags'
       AND vals IS NOT NULL
       AND jsonb_typeof(vals) = 'array'
    THEN
      new_vals := '[]'::jsonb;
      seen := ARRAY[]::text[];

      -- Replace (or drop) each element, de-duplicating while keeping the order
      -- of first occurrence.
      FOR elem IN SELECT value #>> '{}' FROM jsonb_array_elements(vals) LOOP
        IF elem = old_name THEN
          IF new_name IS NULL THEN
            CONTINUE;
          END IF;
          elem := new_name;
        END IF;

        IF elem IS NOT NULL AND NOT (elem = ANY (seen)) THEN
          seen := seen || elem;
          new_vals := new_vals || to_jsonb(elem);
        END IF;
      END LOOP;

      op := cond ->> 'operator';
      IF jsonb_array_length(new_vals) = 0
         AND op IN ('contains', 'contains_all', 'not_contains')
      THEN
        -- Drop the condition entirely.
        CONTINUE;
      END IF;

      cond := jsonb_set(cond, '{value}', new_vals);
    END IF;

    out_conds := out_conds || jsonb_build_array(cond);
  END LOOP;

  RETURN jsonb_set(def, '{conditions}', out_conds);
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 3) Cascade functions. All take p_org_id explicitly — see the header note on
--    why they are service-role only.
-- -----------------------------------------------------------------------------

-- Live usage counts for the Settings → Tags table.
CREATE OR REPLACE FUNCTION public.tag_usage(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  color text,
  is_protected boolean,
  buyers bigint,
  properties bigint,
  segments bigint,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  WITH buyer_counts AS (
    SELECT t.tag AS name, count(*)::bigint AS n
    FROM public.buyers b
    CROSS JOIN LATERAL unnest(b.tags) AS t(tag)
    WHERE b.org_id = p_org_id AND b.tags IS NOT NULL
    GROUP BY t.tag
  ),
  property_counts AS (
    SELECT t.tag AS name, count(*)::bigint AS n
    FROM public.properties p
    CROSS JOIN LATERAL unnest(p.tags) AS t(tag)
    WHERE p.org_id = p_org_id AND p.tags IS NOT NULL
    GROUP BY t.tag
  ),
  segment_counts AS (
    SELECT tg.name, count(DISTINCT s.id)::bigint AS n
    FROM public.segments s
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.definition -> 'conditions', '[]'::jsonb)) AS c(cond)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(c.cond -> 'value') = 'array' THEN c.cond -> 'value' ELSE '[]'::jsonb END
    ) AS v(val)
    JOIN public.tags tg ON tg.org_id = p_org_id AND tg.name = v.val
    WHERE s.org_id = p_org_id
      AND s.deleted_at IS NULL
      AND c.cond ->> 'kind' = 'attribute'
      AND c.cond ->> 'field' = 'tags'
    GROUP BY tg.name
  )
  SELECT
    t.id,
    t.name,
    t.color,
    t.is_protected,
    coalesce(bc.n, 0) AS buyers,
    coalesce(pc.n, 0) AS properties,
    coalesce(sc.n, 0) AS segments,
    t.created_at
  FROM public.tags t
  LEFT JOIN buyer_counts bc ON bc.name = t.name
  LEFT JOIN property_counts pc ON pc.name = t.name
  LEFT JOIN segment_counts sc ON sc.name = t.name
  WHERE t.org_id = p_org_id
  ORDER BY t.name;
$fn$;

CREATE OR REPLACE FUNCTION public.tag_rename(p_org_id uuid, p_tag_id uuid, p_new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_old        text;
  v_protected  boolean;
  v_new        text := btrim(coalesce(p_new_name, ''));
BEGIN
  IF length(v_new) < 1 OR length(v_new) > 60 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;

  SELECT name, is_protected INTO v_old, v_protected
  FROM public.tags WHERE id = p_tag_id AND org_id = p_org_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'tag_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_protected THEN
    RAISE EXCEPTION 'protected_tag' USING ERRCODE = '42501';
  END IF;

  -- A case-only change to the same row is fine; colliding with a DIFFERENT tag
  -- is not — the user wants Merge for that.
  IF EXISTS (
    SELECT 1 FROM public.tags
    WHERE org_id = p_org_id AND id <> p_tag_id AND lower(name) = lower(v_new)
  ) THEN
    RAISE EXCEPTION 'name_taken' USING ERRCODE = '23505';
  END IF;

  IF v_old = v_new THEN
    RETURN;
  END IF;

  UPDATE public.tags SET name = v_new WHERE id = p_tag_id AND org_id = p_org_id;

  UPDATE public.buyers
  SET tags = (
    SELECT coalesce(array_agg(x ORDER BY ord), '{}')
    FROM (
      SELECT DISTINCT ON (x) x, ord
      FROM unnest(array_replace(tags, v_old, v_new)) WITH ORDINALITY u(x, ord)
      ORDER BY x, ord
    ) d
  )
  WHERE org_id = p_org_id AND v_old = ANY (tags);

  UPDATE public.properties
  SET tags = (
    SELECT coalesce(array_agg(x ORDER BY ord), '{}')
    FROM (
      SELECT DISTINCT ON (x) x, ord
      FROM unnest(array_replace(tags, v_old, v_new)) WITH ORDINALITY u(x, ord)
      ORDER BY x, ord
    ) d
  )
  WHERE org_id = p_org_id AND v_old = ANY (tags);

  -- Soft-deleted segments included on purpose: a restore must not come back
  -- referencing a name that no longer exists.
  UPDATE public.segments
  SET definition = public.tag_rewrite_definition(definition, v_old, v_new)
  WHERE org_id = p_org_id;

  -- Draft/scheduled campaigns only. A sent campaign is a historical record.
  UPDATE public.campaigns
  SET audience_definition = public.tag_rewrite_definition(audience_definition, v_old, v_new)
  WHERE org_id = p_org_id AND status IS DISTINCT FROM 'sent';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tag_merge(p_org_id uuid, p_source_id uuid, p_target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_source      text;
  v_target      text;
  v_src_protect boolean;
BEGIN
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'same_tag' USING ERRCODE = '22023';
  END IF;

  SELECT name, is_protected INTO v_source, v_src_protect
  FROM public.tags WHERE id = p_source_id AND org_id = p_org_id;
  SELECT name INTO v_target
  FROM public.tags WHERE id = p_target_id AND org_id = p_org_id;

  IF v_source IS NULL OR v_target IS NULL THEN
    RAISE EXCEPTION 'tag_not_found' USING ERRCODE = 'P0002';
  END IF;
  -- Merging INTO a system tag is fine; merging one away is not.
  IF v_src_protect THEN
    RAISE EXCEPTION 'protected_tag' USING ERRCODE = '42501';
  END IF;

  UPDATE public.buyers
  SET tags = (
    SELECT coalesce(array_agg(x ORDER BY ord), '{}')
    FROM (
      SELECT DISTINCT ON (x) x, ord
      FROM unnest(array_replace(tags, v_source, v_target)) WITH ORDINALITY u(x, ord)
      ORDER BY x, ord
    ) d
  )
  WHERE org_id = p_org_id AND v_source = ANY (tags);

  UPDATE public.properties
  SET tags = (
    SELECT coalesce(array_agg(x ORDER BY ord), '{}')
    FROM (
      SELECT DISTINCT ON (x) x, ord
      FROM unnest(array_replace(tags, v_source, v_target)) WITH ORDINALITY u(x, ord)
      ORDER BY x, ord
    ) d
  )
  WHERE org_id = p_org_id AND v_source = ANY (tags);

  UPDATE public.segments
  SET definition = public.tag_rewrite_definition(definition, v_source, v_target)
  WHERE org_id = p_org_id;

  UPDATE public.campaigns
  SET audience_definition = public.tag_rewrite_definition(audience_definition, v_source, v_target)
  WHERE org_id = p_org_id AND status IS DISTINCT FROM 'sent';

  DELETE FROM public.tags WHERE id = p_source_id AND org_id = p_org_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tag_delete(p_org_id uuid, p_tag_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_name      text;
  v_protected boolean;
BEGIN
  SELECT name, is_protected INTO v_name, v_protected
  FROM public.tags WHERE id = p_tag_id AND org_id = p_org_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'tag_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_protected THEN
    RAISE EXCEPTION 'protected_tag' USING ERRCODE = '42501';
  END IF;

  UPDATE public.buyers SET tags = array_remove(tags, v_name)
  WHERE org_id = p_org_id AND v_name = ANY (tags);

  UPDATE public.properties SET tags = array_remove(tags, v_name)
  WHERE org_id = p_org_id AND v_name = ANY (tags);

  UPDATE public.segments
  SET definition = public.tag_rewrite_definition(definition, v_name, NULL)
  WHERE org_id = p_org_id;

  UPDATE public.campaigns
  SET audience_definition = public.tag_rewrite_definition(audience_definition, v_name, NULL)
  WHERE org_id = p_org_id AND status IS DISTINCT FROM 'sent';

  DELETE FROM public.tags WHERE id = p_tag_id AND org_id = p_org_id;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 4) Lock the cascade to the service role. The API routes call these through
--    supabaseAdmin after checking the session and the settings.tags permission.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.tag_usage(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_usage(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.tag_rename(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_rename(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.tag_merge(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_merge(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.tag_delete(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_delete(uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Self-test for tag_rewrite_definition. If any case fails this RAISEs and the
--    whole transaction rolls back, so a broken helper is never left behind.
-- -----------------------------------------------------------------------------
DO $test$
DECLARE
  got jsonb;
BEGIN
  -- (1) rename inside a `contains` condition
  got := public.tag_rewrite_definition(
    '{"match":"all","conditions":[{"kind":"attribute","field":"tags","operator":"contains","value":["Old","Keep"]}]}'::jsonb,
    'Old', 'New');
  IF got -> 'conditions' -> 0 -> 'value' <> '["New","Keep"]'::jsonb THEN
    RAISE EXCEPTION 'tag_rewrite_definition self-test 1 (rename) failed: %', got;
  END IF;

  -- (2) a rename that creates a duplicate is de-duplicated, first-occurrence order kept
  got := public.tag_rewrite_definition(
    '{"match":"all","conditions":[{"kind":"attribute","field":"tags","operator":"contains","value":["Old","New","Keep"]}]}'::jsonb,
    'Old', 'New');
  IF got -> 'conditions' -> 0 -> 'value' <> '["New","Keep"]'::jsonb THEN
    RAISE EXCEPTION 'tag_rewrite_definition self-test 2 (dedupe) failed: %', got;
  END IF;

  -- (3) a delete that empties a `contains` condition drops the condition
  got := public.tag_rewrite_definition(
    '{"match":"all","conditions":[{"kind":"attribute","field":"tags","operator":"contains","value":["Only"]}]}'::jsonb,
    'Only', NULL);
  IF jsonb_array_length(got -> 'conditions') <> 0 THEN
    RAISE EXCEPTION 'tag_rewrite_definition self-test 3 (drop empty) failed: %', got;
  END IF;

  -- (4) a non-tag condition is untouched
  got := public.tag_rewrite_definition(
    '{"match":"all","conditions":[{"kind":"attribute","field":"locations","operator":"contains","value":["Old"]},{"kind":"behavioral","metric":"opened","operator":"did","scope":{"type":"any_campaign"}}]}'::jsonb,
    'Old', 'New');
  IF got -> 'conditions' -> 0 -> 'value' <> '["Old"]'::jsonb
     OR jsonb_array_length(got -> 'conditions') <> 2 THEN
    RAISE EXCEPTION 'tag_rewrite_definition self-test 4 (non-tag passthrough) failed: %', got;
  END IF;

  -- (5) a null definition returns null
  IF public.tag_rewrite_definition(NULL, 'Old', 'New') IS NOT NULL THEN
    RAISE EXCEPTION 'tag_rewrite_definition self-test 5 (null) failed';
  END IF;
END;
$test$;

COMMIT;
