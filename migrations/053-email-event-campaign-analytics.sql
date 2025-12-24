-- Extend email_events with campaign context and analytics helpers
alter table email_events
  add column if not exists campaign_id uuid references campaigns(id),
  add column if not exists recipient_id uuid references campaign_recipients(id),
  add column if not exists buyer_id uuid references buyers(id),
  add column if not exists message_id text;

create index if not exists email_events_campaign_idx on email_events(campaign_id);
create index if not exists email_events_campaign_event_idx on email_events(campaign_id, event_type);
create index if not exists email_events_campaign_created_idx on email_events(campaign_id, created_at);

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'email_events_provider_event_uniq_idx'
  ) then
    create unique index email_events_provider_event_uniq_idx
      on email_events(provider_message_id, event_type);
  end if;
end $$;

create or replace view campaign_event_metrics as
  select
    campaign_id,
    event_type,
    count(*) as total_events,
    count(distinct recipient_id) as unique_recipients
  from email_events
  where campaign_id is not null
  group by campaign_id, event_type;

create or replace function campaign_event_summary(p_campaign_id uuid)
returns table(event_type text, total bigint, unique_recipients bigint)
stable
language sql as $$
  select event_type, total_events as total, unique_recipients
  from campaign_event_metrics
  where campaign_id = p_campaign_id;
$$;

create or replace function campaign_top_links(p_campaign_id uuid)
returns table(url text, total_clicks bigint, unique_clickers bigint)
stable
language sql as $$
  select
    payload->'click'->>'link' as url,
    count(*) as total_clicks,
    count(distinct recipient_id) as unique_clickers
  from email_events
  where campaign_id = p_campaign_id
    and event_type = 'click'
    and payload->'click'->>'link' is not null
  group by url
  order by total_clicks desc
  limit 50;
$$;

create or replace function campaign_event_timeline(p_campaign_id uuid)
returns table(bucket timestamptz, opens bigint, clicks bigint)
stable
language sql as $$
  select
    date_trunc('hour', created_at) as bucket,
    count(*) filter (where event_type = 'open') as opens,
    count(*) filter (where event_type = 'click') as clicks
  from email_events
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;

create or replace function campaign_recent_events(p_campaign_id uuid)
returns table(at timestamptz, type text, recipient_id uuid, buyer_id uuid, payload jsonb)
stable
language sql as $$
  select
    created_at as at,
    event_type as type,
    recipient_id,
    buyer_id,
    payload
  from email_events
  where campaign_id = p_campaign_id
  order by created_at desc
  limit 50;
$$;

create or replace function campaign_recipient_summary(p_campaign_id uuid)
returns table(
  total bigint,
  sent bigint,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint,
  unsubscribed bigint,
  errors bigint
)
stable
language sql as $$
  select
    count(*) as total,
    count(*) filter (where sent_at is not null) as sent,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where opened_at is not null) as opened,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where bounced_at is not null) as bounced,
    count(*) filter (where complained_at is not null) as complained,
    count(*) filter (where unsubscribed_at is not null) as unsubscribed,
    count(*) filter (where status = 'error') as errors
  from campaign_recipients
  where campaign_id = p_campaign_id;
$$;
