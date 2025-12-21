-- SES + SNS webhook storage and suppression
alter table buyers
  add column if not exists email_suppressed boolean not null default false,
  add column if not exists email_bounced_at timestamptz,
  add column if not exists email_complained_at timestamptz;

alter table campaign_recipients
  add column if not exists delivered_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rendering_failed_at timestamptz,
  add column if not exists delivery_delayed_at timestamptz;

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text,
  event_type text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists email_events_provider_id_idx on email_events(provider_message_id);
