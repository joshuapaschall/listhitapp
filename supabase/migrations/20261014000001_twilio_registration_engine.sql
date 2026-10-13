-- =============================================================================
-- Phase 2B: Twilio registration engine.
--
-- ⚠️  PASTE AND RUN THIS ENTIRE FILE AS ONE QUERY. DO NOT SPLIT IT. ⚠️
--
-- ⚠️  APPLY BEFORE deploying the Phase 2B code. ⚠️
--     The engine, the /api/org-twilio/* routes and the registration cron read
--     and write the new org_twilio columns (setup_stage, spend gate, mock flag,
--     Event Streams SIDs, scheduling). Without them every engine run errors.
--
-- WHY
--   One idempotent engine now drives every non-owner org through Twilio's ISV
--   A2P 10DLC order (Standard or Sole Proprietor). It needs:
--     - org_twilio: the customer-facing stage, the brand type, the spend
--       approval, the per-org mock flag, the desired number, the statuses and
--       error lists Twilio returns, Event Streams SIDs, and the scheduling /
--       lease / notification timestamps;
--     - business_verification: the authorized rep's real title, job position
--       and phone (they were hardcoded to ListHit's before);
--     - a2p_registration: the exact message flow and privacy / terms URLs we
--       submit, stored for transparency.
--
-- VERIFICATION (run after applying):
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'org_twilio'
--      and column_name in ('setup_stage','spend_approved_at','mock_registration',
--                          'event_sink_sid','advancing_until','live_notified_at');
--     -- expect 6 rows
--   select setup_stage, count(*) from public.org_twilio group by 1;
--     -- expect every existing row at 'not_started'
--   select conname from pg_constraint
--    where conname in ('org_twilio_setup_stage_check','org_twilio_brand_type_check',
--                      'business_verification_rep_job_position_check');
--     -- expect 3 rows
-- =============================================================================

BEGIN;

-- org_twilio: engine state
ALTER TABLE public.org_twilio
  ADD COLUMN IF NOT EXISTS setup_stage text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS brand_type text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS spend_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS spend_approved_by uuid,
  ADD COLUMN IF NOT EXISTS mock_registration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desired_phone_number text,
  ADD COLUMN IF NOT EXISTS desired_area_code text,
  ADD COLUMN IF NOT EXISTS trust_product_status text,
  ADD COLUMN IF NOT EXISTS brand_identity_status text,
  ADD COLUMN IF NOT EXISTS brand_errors jsonb,
  ADD COLUMN IF NOT EXISTS campaign_errors jsonb,
  ADD COLUMN IF NOT EXISTS customer_issues jsonb,
  ADD COLUMN IF NOT EXISTS brand_update_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS event_sink_sid text,
  ADD COLUMN IF NOT EXISTS event_subscription_sid text,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS advancing_until timestamptz,
  ADD COLUMN IF NOT EXISTS live_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_notified_at timestamptz;

ALTER TABLE public.org_twilio DROP CONSTRAINT IF EXISTS org_twilio_setup_stage_check;
ALTER TABLE public.org_twilio ADD CONSTRAINT org_twilio_setup_stage_check CHECK (setup_stage IN
  ('not_started','awaiting_approval','submitting','in_review','verify_mobile','action_required','live','rejected'));
ALTER TABLE public.org_twilio DROP CONSTRAINT IF EXISTS org_twilio_brand_type_check;
ALTER TABLE public.org_twilio ADD CONSTRAINT org_twilio_brand_type_check CHECK (brand_type IS NULL OR brand_type IN ('STANDARD','SOLE_PROPRIETOR'));
CREATE INDEX IF NOT EXISTS idx_org_twilio_stage_next_check ON public.org_twilio (setup_stage, next_check_at);

-- business_verification: real authorized-rep fields (previously hardcoded to ListHit's)
ALTER TABLE public.business_verification
  ADD COLUMN IF NOT EXISTS rep_title text,
  ADD COLUMN IF NOT EXISTS rep_job_position text,
  ADD COLUMN IF NOT EXISTS rep_phone text;
ALTER TABLE public.business_verification DROP CONSTRAINT IF EXISTS business_verification_rep_job_position_check;
ALTER TABLE public.business_verification ADD CONSTRAINT business_verification_rep_job_position_check CHECK
  (rep_job_position IS NULL OR rep_job_position IN ('Director','GM','VP','CEO','CFO','General Counsel','Other'));

-- a2p_registration: what we actually submit, stored for transparency
ALTER TABLE public.a2p_registration
  ADD COLUMN IF NOT EXISTS message_flow text,
  ADD COLUMN IF NOT EXISTS privacy_policy_url text,
  ADD COLUMN IF NOT EXISTS terms_url text;

COMMIT;

-- -----------------------------------------------------------------------------
-- ROLLBACK (run as one query; drops the engine state — every org's stage, spend
-- approval, mock flag and stored Twilio statuses are lost):
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_org_twilio_stage_next_check;
-- ALTER TABLE public.org_twilio DROP CONSTRAINT IF EXISTS org_twilio_brand_type_check;
-- ALTER TABLE public.org_twilio DROP CONSTRAINT IF EXISTS org_twilio_setup_stage_check;
-- ALTER TABLE public.org_twilio
--   DROP COLUMN IF EXISTS setup_stage, DROP COLUMN IF EXISTS brand_type,
--   DROP COLUMN IF EXISTS submitted_at, DROP COLUMN IF EXISTS spend_approved_at,
--   DROP COLUMN IF EXISTS spend_approved_by, DROP COLUMN IF EXISTS mock_registration,
--   DROP COLUMN IF EXISTS desired_phone_number, DROP COLUMN IF EXISTS desired_area_code,
--   DROP COLUMN IF EXISTS trust_product_status, DROP COLUMN IF EXISTS brand_identity_status,
--   DROP COLUMN IF EXISTS brand_errors, DROP COLUMN IF EXISTS campaign_errors,
--   DROP COLUMN IF EXISTS customer_issues, DROP COLUMN IF EXISTS brand_update_count,
--   DROP COLUMN IF EXISTS event_sink_sid, DROP COLUMN IF EXISTS event_subscription_sid,
--   DROP COLUMN IF EXISTS next_check_at, DROP COLUMN IF EXISTS last_checked_at,
--   DROP COLUMN IF EXISTS advancing_until, DROP COLUMN IF EXISTS live_at,
--   DROP COLUMN IF EXISTS live_notified_at, DROP COLUMN IF EXISTS issue_notified_at;
-- ALTER TABLE public.business_verification DROP CONSTRAINT IF EXISTS business_verification_rep_job_position_check;
-- ALTER TABLE public.business_verification
--   DROP COLUMN IF EXISTS rep_title, DROP COLUMN IF EXISTS rep_job_position, DROP COLUMN IF EXISTS rep_phone;
-- ALTER TABLE public.a2p_registration
--   DROP COLUMN IF EXISTS message_flow, DROP COLUMN IF EXISTS privacy_policy_url, DROP COLUMN IF EXISTS terms_url;
-- COMMIT;
