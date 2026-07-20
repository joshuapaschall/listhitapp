-- Batched per-campaign recipient rollups for the Campaigns list page.
-- Replaces the embedded campaign_recipients(...) array, which PostgREST caps
-- at 1000 rows, silently truncating recipient counts and engagement stats for
-- any campaign over 1000 recipients.
--
-- Plain STABLE sql function (NOT security definer) so the caller's RLS on
-- campaign_recipients applies -> naturally org-scoped, same pattern as
-- public.campaign_sms_summary.
--
-- Apply manually in the Supabase SQL editor. Deploy BEFORE merging the code
-- that calls it.

drop function if exists public.campaign_list_rollups(uuid[]);

create or replace function public.campaign_list_rollups(p_campaign_ids uuid[])
returns table(
  campaign_id uuid,
  recipients bigint,
  sent bigint,
  delivered bigint,
  clicked bigint,
  opened bigint,
  errors bigint,
  bounced bigint,
  unsubscribed bigint
)
stable
language sql
as $$
  select
    campaign_id,
    count(*) as recipients,
    count(*) filter (where sent_at is not null) as sent,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where opened_at is not null) as opened,
    count(*) filter (where status = 'error' or error is not null) as errors,
    count(*) filter (where bounced_at is not null) as bounced,
    count(*) filter (where unsubscribed_at is not null) as unsubscribed
  from public.campaign_recipients
  where campaign_id = any(p_campaign_ids)
  group by campaign_id;
$$;

grant execute on function public.campaign_list_rollups(uuid[]) to service_role, authenticated;
