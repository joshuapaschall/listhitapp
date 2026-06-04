alter table public.buyers
  add column if not exists sms_suppressed boolean not null default false,
  add column if not exists sms_suppressed_at timestamptz,
  add column if not exists sms_suppressed_reason text;

alter table public.campaign_recipients
  add column if not exists line_type text;
