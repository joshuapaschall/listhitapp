-- Campaign analytics fixes

alter table public.email_events
  add column if not exists event_ts timestamptz;

update public.email_events
set event_ts = coalesce(
  nullif(payload->'open'->>'timestamp', '')::timestamptz,
  nullif(payload->'click'->>'timestamp', '')::timestamptz,
  nullif(payload->'delivery'->>'timestamp', '')::timestamptz,
  nullif(payload->'bounce'->>'timestamp', '')::timestamptz,
  nullif(payload->'complaint'->>'timestamp', '')::timestamptz,
  nullif(payload->'notification'->'bounce'->>'timestamp', '')::timestamptz,
  nullif(payload->'notification'->'complaint'->>'timestamp', '')::timestamptz,
  nullif(payload->'mail'->>'timestamp', '')::timestamptz,
  created_at
)
where event_ts is null;

create index if not exists email_events_campaign_event_ts_idx
  on public.email_events(campaign_id, event_ts desc);

create index if not exists email_events_campaign_event_type_ts_idx
  on public.email_events(campaign_id, event_type, event_ts desc);

drop function if exists public.campaign_event_summary(uuid);
drop function if exists public.campaign_event_timeline(uuid);
drop function if exists public.campaign_recent_events(uuid);
drop function if exists public.campaign_top_links(uuid);

create or replace function public.campaign_event_summary(p_campaign_id uuid)
returns table(event_type text, total bigint, unique_recipients bigint)
stable
language sql as $$
  select event_type, total_events as total, unique_recipients
  from public.campaign_event_metrics
  where campaign_id = p_campaign_id;
$$;

create or replace function public.campaign_top_links(p_campaign_id uuid)
returns table(url text, total_clicks bigint, unique_clickers bigint)
stable
language sql as $$
  select
    payload->'click'->>'link' as url,
    count(*) as total_clicks,
    count(distinct recipient_id) as unique_clickers
  from public.email_events
  where campaign_id = p_campaign_id
    and event_type = 'click'
    and payload->'click'->>'link' is not null
  group by url
  order by total_clicks desc
  limit 50;
$$;

create or replace function public.campaign_event_timeline(p_campaign_id uuid)
returns table(bucket timestamptz, opens bigint, clicks bigint)
stable
language sql as $$
  select
    date_trunc('hour', coalesce(event_ts, created_at)) as bucket,
    count(*) filter (where event_type = 'open') as opens,
    count(*) filter (where event_type = 'click') as clicks
  from public.email_events
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;

create or replace function public.campaign_recent_events(p_campaign_id uuid)
returns table(event_time timestamptz, type text, recipient_id uuid, buyer_id uuid, payload jsonb)
stable
language sql as $$
  select
    coalesce(event_ts, created_at) as event_time,
    event_type as type,
    recipient_id,
    buyer_id,
    payload
  from public.email_events
  where campaign_id = p_campaign_id
  order by coalesce(event_ts, created_at) desc, created_at desc, id desc
  limit 50;
$$;
