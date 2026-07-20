-- Powers the honest campaign-status column on the Campaigns list.
-- Apply manually in the Supabase SQL editor. Deploy BEFORE merging the code.

-- 1) Per-campaign remaining work across BOTH queues (sms + email).
--    Plain STABLE (invoker rights) so each queue table's org-scoped RLS applies
--    -> naturally org-scoped for the authenticated browser client.
drop function if exists public.campaign_queue_status(uuid[]);
create or replace function public.campaign_queue_status(p_campaign_ids uuid[])
returns table(
  campaign_id uuid,
  pending bigint,
  processing bigint,
  earliest_next timestamptz
)
stable
language sql
as $$
  with q as (
    select campaign_id, status, scheduled_for
    from public.sms_campaign_queue
    where campaign_id = any(p_campaign_ids)
    union all
    select campaign_id, status, scheduled_for
    from public.email_campaign_queue
    where campaign_id = any(p_campaign_ids)
  )
  select
    campaign_id,
    count(*) filter (where status = 'pending')                       as pending,
    count(*) filter (where status = 'processing')                    as processing,
    min(scheduled_for) filter (where status = 'pending')             as earliest_next
  from q
  group by campaign_id;
$$;
grant execute on function public.campaign_queue_status(uuid[]) to service_role, authenticated;

-- 2) Global account email-sending freeze flag.
--    SECURITY DEFINER because ses_reputation_snapshots has RLS with no
--    authenticated SELECT policy. Returns only a single global boolean (no
--    per-org data), so it is safe to expose to any authenticated user.
drop function if exists public.email_reputation_frozen();
create or replace function public.email_reputation_frozen()
returns boolean
stable
security definer
set search_path to 'public', 'pg_temp'
language sql
as $$
  select coalesce(
    (select sending_state = 'frozen'
     from public.ses_reputation_snapshots
     order by captured_at desc
     limit 1),
    false
  );
$$;
grant execute on function public.email_reputation_frozen() to service_role, authenticated;
