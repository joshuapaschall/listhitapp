-- ============================================================================
-- P2 M1 — Drop the GWH org_id DEFAULT on the four messaging tables
-- ============================================================================
-- Purpose: make a missing org_id FAIL LOUD (NOT NULL violation) instead of
-- silently defaulting into the GWH org (cross-tenant commingling). NOT NULL is
-- RETAINED; only the DEFAULT is removed. This is metadata-only DDL: no row
-- rewrite, no table rewrite, negligible lock.
--
-- Scope: ONLY these four tables:
--       messages, message_threads, buyer_sms_senders, sms_campaign_queue
--   The other ~31 org_id-rollout tables (email_*, gmail_*, buyers, properties,
--   campaigns, etc.) KEEP their GWH default for now — their writers are not yet
--   audited/fixed. Do NOT extend this migration to them.
--
-- PREREQUISITES — verify ALL before running the BEGIN/COMMIT block:
--   1. Batch B2 (upsertAnonThread) is MERGED to main and deployed (#836).
--   2. DEFAULT_ORG_ID is set in the Vercel environment to the GWH org id
--      adddfd02-790e-4be7-a0df-047b7dbdd1b8. It MUST be that UUID: the code
--      validates the shape (lib/auth/default-org.ts) and treats any non-UUID
--      value as unset, which turns every org-less write into a hard failure.
--   3. The writer-side fallbacks ship first — these paths previously relied on
--      the column default and now fall back to DEFAULT_ORG_ID instead:
--        lib/sms/inbound-handler.ts   (message_threads, messages)
--        lib/sender/sticky-sender.ts  (buyer_sms_senders)
--        services/sms-campaign-sender.ts (sms_campaign_queue)
--        lib/showing-notifications.ts (notification writers)
--        services/thread-utils.ts     (anon threads)
--   4. The PRE-FLIGHT query below shows a GWH default + NOT NULL on all four
--      tables (confirms starting state and gives you the exact rollback value).
-- ============================================================================


-- ─────────────────────────────── PRE-FLIGHT ────────────────────────────────
-- Run this FIRST, on its own. Expect four rows, each with:
--   column_default = 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid   (or similar)
--   is_nullable    = NO
-- If column_default is already NULL for a table, that table is already migrated
-- (or never had the default) — do not be alarmed, the ALTER below is idempotent
-- in effect (dropping an absent default is a no-op). If is_nullable = YES on any
-- of these, STOP and investigate — NOT NULL must be in place first.

-- SELECT table_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name = 'org_id'
--   AND table_name IN ('messages','message_threads','buyer_sms_senders','sms_campaign_queue')
-- ORDER BY table_name;


-- ──────────────────────────────── MIGRATION ────────────────────────────────

BEGIN;

ALTER TABLE public.messages            ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.message_threads     ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.buyer_sms_senders   ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.sms_campaign_queue  ALTER COLUMN org_id DROP DEFAULT;

COMMIT;


-- ─────────────────────────────── POST-CHECK ────────────────────────────────
-- Run this AFTER the COMMIT. Expect four rows, each with:
--   column_default = NULL
--   is_nullable    = NO
-- That combination is the goal: a write that omits org_id now raises
--   ERROR: null value in column "org_id" ... violates not-null constraint
-- instead of silently landing in GWH.

-- SELECT table_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name = 'org_id'
--   AND table_name IN ('messages','message_threads','buyer_sms_senders','sms_campaign_queue')
-- ORDER BY table_name;


-- ============================================================================
-- ROLLBACK (paired) — restores the prior GWH default on all four tables.
-- Use the EXACT default value the PRE-FLIGHT query reported (pre-filled with the
-- GWH org id below; confirm it matches before running).
-- ============================================================================
--
-- BEGIN;
--
-- ALTER TABLE public.messages            ALTER COLUMN org_id SET DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid;
-- ALTER TABLE public.message_threads     ALTER COLUMN org_id SET DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid;
-- ALTER TABLE public.buyer_sms_senders   ALTER COLUMN org_id SET DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid;
-- ALTER TABLE public.sms_campaign_queue  ALTER COLUMN org_id SET DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid;
--
-- COMMIT;
-- ============================================================================
