drop function if exists public.campaign_sms_summary(uuid);
create or replace function public.campaign_sms_summary(p_campaign_id uuid)
returns table(
  total bigint,
  sent bigint,
  delivered bigint,
  clicked bigint,
  replied bigint,
  failed bigint,
  undelivered bigint,
  opted_out bigint,
  total_cost_usd numeric,
  total_segments bigint,
  avg_segments numeric
)
stable
language sql as $$
  select
    count(*) as total,
    count(*) filter (where sent_at is not null) as sent,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where replied_at is not null) as replied,
    count(*) filter (where rejected_at is not null
      or status in ('delivery_failed','sending_failed','failed','undelivered')) as failed,
    count(*) filter (where delivery_delayed_at is not null
      or status in ('delivery_unconfirmed','unconfirmed')) as undelivered,
    count(*) filter (where unsubscribed_at is not null) as opted_out,
    coalesce(sum(actual_cost_usd), 0) as total_cost_usd,
    coalesce(sum(actual_segments), 0) as total_segments,
    coalesce(avg(actual_segments) filter (where actual_segments is not null), 0) as avg_segments
  from public.campaign_recipients
  where campaign_id = p_campaign_id;
$$;

grant execute on function public.campaign_sms_summary(uuid) to service_role, authenticated;

drop function if exists public.campaign_sms_top_links(uuid);
create or replace function public.campaign_sms_top_links(p_campaign_id uuid)
returns table(target_url text, total_clicks bigint, unique_clickers bigint)
stable
language sql as $$
  select
    target_url,
    coalesce(sum(click_count), 0) as total_clicks,
    count(*) filter (where click_count > 0) as unique_clickers
  from public.short_links
  where campaign_id = p_campaign_id
  group by target_url
  order by total_clicks desc
  limit 50;
$$;

grant execute on function public.campaign_sms_top_links(uuid) to service_role, authenticated;

drop function if exists public.campaign_sms_timeline(uuid);
create or replace function public.campaign_sms_timeline(p_campaign_id uuid)
returns table(bucket timestamptz, delivered bigint, clicked bigint, replied bigint)
stable
language sql as $$
  select
    date_trunc('hour', coalesce(sent_at, now())) as bucket,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where replied_at is not null) as replied
  from public.campaign_recipients
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;

grant execute on function public.campaign_sms_timeline(uuid) to service_role, authenticated;
