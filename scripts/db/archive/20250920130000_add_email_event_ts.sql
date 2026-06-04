alter table public.email_events
  add column if not exists event_ts timestamptz;

update public.email_events
set event_ts = coalesce(
  (payload->'click'->>'timestamp')::timestamptz,
  (payload->'open'->>'timestamp')::timestamptz,
  (payload->'delivery'->>'timestamp')::timestamptz,
  (payload->'bounce'->>'timestamp')::timestamptz,
  (payload->'complaint'->>'timestamp')::timestamptz,
  (payload->'mail'->>'timestamp')::timestamptz
)
where event_ts is null;

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
