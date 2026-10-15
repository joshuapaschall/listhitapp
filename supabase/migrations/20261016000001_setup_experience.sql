-- =============================================================================
-- Phase 2C: setup experience (setup hub, DNS assistant, connected emails).
--
-- ⚠️  PASTE AND RUN THIS ENTIRE FILE AS ONE QUERY. DO NOT SPLIT IT. ⚠️
--
-- ⚠️  APPLY BEFORE deploying the Phase 2C code. ⚠️
--     The domain verify routes write live_notified_at / ready_notified_at, and
--     POST /api/dns/share reads and writes dns_share_requests. Without them
--     those routes error.
--
-- WHY
--   - site_domains.live_notified_at: the "Your website is live" email goes out
--     exactly once, when a custom domain is active AND https loads.
--   - email_domains.ready_notified_at: the "Your email sending is set up" email
--     goes out exactly once, when an email domain becomes verified.
--   - dns_share_requests: "Email these steps to someone" is rate limited to 5
--     per org per hour. Serverless instances don't share memory, so the limit is
--     counted in the database. Server-only (RLS on, no policies).
--
-- VERIFICATION (run after applying):
--
--   select table_name, column_name from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name = 'site_domains'  and column_name = 'live_notified_at')
--        or (table_name = 'email_domains' and column_name = 'ready_notified_at'));
--   -- expect 2 rows
--
--   select count(*) from public.dns_share_requests;
--   -- expect 0
--
--   select relrowsecurity from pg_class where oid = 'public.dns_share_requests'::regclass;
--   -- expect true
-- =============================================================================

BEGIN;

ALTER TABLE public.site_domains  ADD COLUMN IF NOT EXISTS live_notified_at timestamptz;
ALTER TABLE public.email_domains ADD COLUMN IF NOT EXISTS ready_notified_at timestamptz;

-- Email domains already verified before this release must not get a surprise
-- "set up" email on their next check. Site domains are NOT backfilled: some
-- rows were marked active before DNS was really checked (fixed in 2B.1), and
-- those customers should still get the email when the domain truly goes live.
UPDATE public.email_domains SET ready_notified_at = now() WHERE status = 'verified' AND ready_notified_at IS NULL;

CREATE TABLE IF NOT EXISTS public.dns_share_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  to_email text NOT NULL,
  domain text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('website', 'email')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dns_share_requests_org_created
  ON public.dns_share_requests (org_id, created_at DESC);

ALTER TABLE public.dns_share_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ROLLBACK (run as one query):
--
-- BEGIN;
-- DROP TABLE IF EXISTS public.dns_share_requests;
-- ALTER TABLE public.site_domains  DROP COLUMN IF EXISTS live_notified_at;
-- ALTER TABLE public.email_domains DROP COLUMN IF EXISTS ready_notified_at;
-- COMMIT;
