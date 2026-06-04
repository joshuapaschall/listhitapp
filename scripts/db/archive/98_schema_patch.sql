-- Database patch: safe schema fixes for existing environments

create unique index if not exists buyer_list_consent_email_list_unique
  on public.buyer_list_consent (email_norm, list_id);

alter table public.email_templates
  add column if not exists subject text,
  add column if not exists template_kind text not null default 'template',
  add column if not exists created_by uuid default auth.uid();

alter table public.email_events
  add column if not exists event_ts timestamptz;

update public.email_events
set event_ts = coalesce(
  (payload->'open'->>'timestamp')::timestamptz,
  (payload->'click'->>'timestamp')::timestamptz,
  (payload->'delivery'->>'timestamp')::timestamptz,
  (payload->'bounce'->>'timestamp')::timestamptz,
  (payload->'complaint'->>'timestamp')::timestamptz,
  (payload->'reject'->>'timestamp')::timestamptz,
  (payload->'mail'->>'timestamp')::timestamptz,
  created_at
)
where event_ts is null;

create index if not exists email_events_campaign_event_ts_idx
  on public.email_events (campaign_id, event_ts);

create index if not exists email_events_campaign_event_type_ts_idx
  on public.email_events (campaign_id, event_type, event_ts desc);
