-- Add SendFox suppression + consent tracking
alter table buyers
  add column if not exists sendfox_bounced_at timestamptz,
  add column if not exists sendfox_complained_at timestamptz,
  add column if not exists sendfox_suppressed boolean not null default false,
  add column if not exists sendfox_double_opt_in_at timestamptz,
  add column if not exists sendfox_double_opt_in boolean not null default false;

alter table campaign_recipients
  add column if not exists clicked_at timestamptz,
  add column if not exists complained_at timestamptz;

create table if not exists buyer_list_consent (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) on delete set null,
  email text not null,
  email_norm text generated always as (lower(trim(email))) stored,
  list_id integer not null,
  double_opt_in boolean not null default false,
  consent_token text,
  consented_at timestamptz,
  confirmed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists buyer_list_consent_token_idx on buyer_list_consent(consent_token) where consent_token is not null;
alter table buyer_list_consent
  add constraint buyer_list_consent_email_list_unique unique (email_norm, list_id);
