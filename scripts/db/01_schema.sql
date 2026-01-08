-- Database bootstrap: core schema (tables + indexes)

-- Organizations (needed for voice routing references)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null,
  is_protected boolean not null default false,
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique,
  description text,
  type text not null default 'manual',
  criteria jsonb,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Buyers
create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  fname text,
  lname text,
  full_name text generated always as (coalesce(fname, '') || ' ' || coalesce(lname, '')) stored,
  email text,
  phone text,
  phone2 text,
  phone3 text,
  company text,
  score integer default 0,
  notes text,
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  website text,
  locations text[],
  tags text[],
  vetted boolean default false,
  vip boolean default false,
  can_receive_sms boolean default true,
  can_receive_calls boolean default true,
  can_receive_email boolean default true,
  property_type text[],
  property_interest text,
  asking_price_min numeric,
  asking_price_max numeric,
  year_built_min integer,
  year_built_max integer,
  sqft_min integer,
  sqft_max integer,
  beds_min integer,
  baths_min numeric,
  min_arv numeric,
  min_arv_percent numeric,
  min_gross_margin numeric,
  max_gross_margin numeric,
  down_payment_min numeric,
  down_payment_max numeric,
  monthly_payment_min numeric,
  monthly_payment_max numeric,
  status text default 'lead',
  source text,
  cash_buyer boolean,
  investor boolean,
  owner_financing boolean,
  first_time_buyer boolean,
  sendfox_contact_id integer,
  sendfox_hidden boolean not null default false,
  sendfox_suppressed boolean not null default false,
  sendfox_bounced_at timestamptz,
  sendfox_complained_at timestamptz,
  sendfox_double_opt_in boolean not null default false,
  sendfox_double_opt_in_at timestamptz,
  email_suppressed boolean not null default false,
  email_bounced_at timestamptz,
  email_complained_at timestamptz,
  is_unsubscribed boolean not null default false,
  unsubscribed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email_norm text generated always as (lower(trim(email))) stored,
  phone_norm text generated always as (regexp_replace(phone, '\\D', '', 'g')) stored,
  phone2_norm text generated always as (regexp_replace(phone2, '\\D', '', 'g')) stored,
  phone3_norm text generated always as (regexp_replace(phone3, '\\D', '', 'g')) stored
);

create index if not exists idx_buyers_sendfox_hidden on public.buyers(sendfox_hidden);
create index if not exists idx_buyers_deleted_at on public.buyers(deleted_at);
create unique index if not exists buyers_email_norm_idx on public.buyers(email_norm) where email_norm is not null;
create unique index if not exists buyers_phone_norm_idx on public.buyers(phone_norm) where phone_norm is not null;
create index if not exists buyers_phone2_norm_idx on public.buyers(phone2_norm);
create index if not exists buyers_phone3_norm_idx on public.buyers(phone3_norm);

-- Gmail threads cache
create table if not exists public.gmail_threads (
  id text primary key,
  snippet text,
  history_id text,
  starred boolean not null default false,
  unread boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Email threads linked to buyers
create table if not exists public.email_threads (
  thread_id text references public.gmail_threads(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  subject text,
  snippet text,
  starred boolean not null default false,
  unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (thread_id, buyer_id)
);

-- Message threads
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  phone_number text not null,
  preferred_from_number text,
  campaign_id uuid,
  starred boolean not null default false,
  unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (buyer_id, phone_number, campaign_id)
);

create unique index if not exists unique_buyer_phone on public.message_threads (buyer_id, phone_number);
create index if not exists idx_message_threads_preferred_from on public.message_threads (preferred_from_number);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.message_threads(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  direction text not null,
  from_number text,
  to_number text,
  body text,
  provider_id text,
  media_urls text[],
  is_bulk boolean not null default false,
  filtered boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Email messages
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  buyer_id uuid not null,
  subject text,
  preview text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (thread_id, buyer_id) references public.email_threads(thread_id, buyer_id) on delete cascade
);

-- Gmail OAuth tokens
create table if not exists public.gmail_tokens (
  user_id uuid primary key references auth.users(id),
  access_token text,
  refresh_token text not null,
  expires_at bigint,
  email text,
  updated_at timestamptz not null default now(),
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  last_sync_error_at timestamptz
);

create index if not exists gmail_tokens_last_synced_at_idx on public.gmail_tokens (last_synced_at);

-- Templates
create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  message text not null,
  template_kind text not null default 'template',
  created_by uuid references auth.users(id) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_reply_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Negative keywords
create table if not exists public.negative_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text unique not null,
  created_at timestamptz not null default now()
);

create unique index if not exists negative_keywords_keyword_idx on public.negative_keywords(keyword);

-- Buyer groups
create table if not exists public.buyer_groups (
  buyer_id uuid references public.buyers(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  primary key (buyer_id, group_id)
);

-- Properties
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text,
  state text,
  zip text,
  latitude numeric,
  longitude numeric,
  price numeric,
  down_payment numeric,
  monthly_payment numeric,
  earnest_money numeric,
  bedrooms integer,
  bathrooms numeric,
  sqft integer,
  description text,
  property_type text,
  disposition_strategy text,
  buyer_fit text,
  condition text,
  occupancy text,
  priority text,
  tags text[],
  video_link text,
  short_url_key text,
  short_url text,
  short_slug text,
  shortio_link_id text,
  website_url text,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Property images
create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Property buyers
create table if not exists public.property_buyers (
  property_id uuid references public.properties(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  primary key (property_id, buyer_id)
);

-- Showings
create table if not exists public.showings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  notes text,
  created_by uuid references auth.users(id),
  reminder_sent boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Offers
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  offer_type text,
  offer_price numeric,
  down_payment numeric,
  monthly_payment numeric,
  earnest_money numeric,
  status text not null default 'submitted',
  notes text,
  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  channel text not null,
  subject text,
  message text not null,
  media_url text,
  buyer_ids uuid[],
  group_ids uuid[],
  send_to_all_numbers boolean not null default true,
  scheduled_at timestamptz,
  status text not null default 'pending',
  weekday_only boolean,
  run_from time,
  run_until time,
  timezone text,
  created_at timestamptz not null default now()
);

-- Campaign recipients
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  sent_at timestamptz,
  provider_id text,
  from_number text,
  short_url_key text,
  short_url text,
  short_slug text,
  shortio_link_id text,
  status text,
  error text,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  delivered_at timestamptz,
  rejected_at timestamptz,
  rendering_failed_at timestamptz,
  delivery_delayed_at timestamptz
);

create index if not exists campaign_recipients_provider_id_idx on public.campaign_recipients(provider_id);

-- Consent logging per SendFox list
create table if not exists public.buyer_list_consent (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete set null,
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

create unique index if not exists buyer_list_consent_token_idx on public.buyer_list_consent(consent_token) where consent_token is not null;
alter table public.buyer_list_consent
  add constraint if not exists buyer_list_consent_email_list_unique unique (email_norm, list_id);

-- Last used SMS sender per buyer
create table if not exists public.buyer_sms_senders (
  buyer_id uuid primary key references public.buyers(id) on delete cascade,
  from_number text,
  created_at timestamptz not null default now()
);

-- AI prompts
create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permissions
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  permission_key text,
  granted boolean not null,
  constraint permissions_user_key unique (user_id, permission_key)
);

-- Telnyx credentials
create table if not exists public.telnyx_credentials (
  id text primary key,
  sip_username text not null,
  sip_password text not null,
  connection_id text not null,
  created_at timestamptz not null default now()
);

-- Voice numbers
create table if not exists public.voice_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  friendly_name text,
  provider_id text unique,
  connection_id text,
  messaging_profile_id text,
  status text,
  tags text[],
  created_at timestamptz not null default now()
);

-- Agents
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text not null,
  sip_username text,
  sip_password text,
  telnyx_credential_id text,
  telephony_credential_id text,
  status text default 'offline' check (status in ('available', 'busy', 'offline')),
  last_call_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists agents_status_idx on public.agents(status);
create index if not exists agents_email_idx on public.agents(email);
create index if not exists agents_auth_user_idx on public.agents(auth_user_id);

-- Agent sessions (call control)
create table if not exists public.agent_sessions (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  call_control_id text unique not null,
  jwt_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_sessions_call_control_idx on public.agent_sessions(call_control_id);

-- Agent active calls
create table if not exists public.agent_active_calls (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid unique references public.agents(id),
  customer_leg_id text,
  agent_leg_id text,
  consult_leg_id text,
  hold_state text default 'active',
  playback_state text default 'idle',
  last_playback_cmd_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists agent_active_calls_agent_idx on public.agent_active_calls(agent_id);
create index if not exists agent_active_calls_hold_state_idx on public.agent_active_calls(hold_state);

-- Call transfers
create table if not exists public.call_transfers (
  id uuid primary key default gen_random_uuid(),
  call_control_id text not null,
  transfer_type text not null,
  destination text not null,
  consult_leg_id text,
  status text not null default 'pending',
  initiated_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists call_transfers_control_id_idx on public.call_transfers(call_control_id);
create index if not exists call_transfers_consult_leg_idx on public.call_transfers(consult_leg_id);
create index if not exists call_transfers_status_idx on public.call_transfers(status);

-- Call session map
create table if not exists public.calls_sessions (
  agent_session_id text primary key,
  customer_call_control_id text not null unique,
  status text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent events
create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz default now()
);

-- Calls
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id),
  direction text not null,
  from_number text,
  to_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration integer,
  call_sid text unique,
  recording_url text,
  notes text,
  status text,
  answered_at timestamptz,
  bridged_at timestamptz,
  duration_seconds integer,
  hangup_source text,
  hangup_cause text,
  telnyx_recording_id text,
  recording_state text default 'pending',
  recording_duration_seconds integer,
  recording_accessed_at timestamptz,
  recording_accessed_by uuid references public.agents(id),
  searchable tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(from_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(to_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(status, '')), 'C')
  ) stored,
  webrtc boolean not null default false,
  from_agent_id uuid references public.agents(id),
  recording_confidence double precision
);

create index if not exists calls_recording_state_idx on public.calls(recording_state);
create index if not exists calls_started_at_desc_idx on public.calls(started_at desc);
create index if not exists calls_buyer_idx on public.calls(buyer_id);
create index if not exists calls_search_gin_idx on public.calls using gin(searchable);
create index if not exists calls_from_trgm_idx on public.calls using gin(from_number gin_trgm_ops);
create index if not exists calls_to_trgm_idx on public.calls using gin(to_number gin_trgm_ops);
create index if not exists calls_from_agent_idx on public.calls(from_agent_id);

-- Recording access log
create table if not exists public.recording_access_log (
  id uuid primary key default gen_random_uuid(),
  call_sid text references public.calls(call_sid),
  accessed_by uuid references public.agents(id),
  access_type text check (access_type in ('play', 'download', 'share')),
  accessed_at timestamptz default now(),
  ip_address inet,
  user_agent text
);

create index if not exists recording_access_call_idx on public.recording_access_log(call_sid);
create index if not exists recording_access_agent_idx on public.recording_access_log(accessed_by);
create index if not exists recording_access_time_idx on public.recording_access_log(accessed_at desc);

-- Active conferences
create table if not exists public.active_conferences (
  id uuid primary key default gen_random_uuid(),
  conference_id varchar(255) not null,
  call_sid varchar(255) not null,
  from_number varchar(50) not null,
  to_number varchar(50) not null,
  webrtc_joined boolean default false,
  created_at timestamptz default current_timestamp,
  ended_at timestamptz
);

create unique index if not exists active_conferences_conference_id_key on public.active_conferences(conference_id);
create index if not exists idx_active_conferences_created_at on public.active_conferences(created_at desc);
create index if not exists idx_active_conferences_webrtc_joined on public.active_conferences(webrtc_joined);

-- Agent presence sessions (WebRTC)
create table if not exists public.agents_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents(id) on delete cascade,
  sip_username text not null,
  status text not null check (status in ('online', 'offline')),
  last_seen timestamptz not null default now(),
  client_id text not null,
  unique (agent_id, client_id)
);

create index if not exists agents_sessions_online_idx on public.agents_sessions(status, last_seen desc);

-- Voice routing tables
create table if not exists public.org_voice_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  fallback_mode text not null default 'dispatcher_sip' check (fallback_mode in ('dispatcher_sip', 'ring_all', 'voicemail', 'none')),
  fallback_sip_username text,
  voicemail_media_url text,
  queue_timeout_secs int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_numbers (
  e164 text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  telnyx_number_id text,
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User integrations
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Media links
create table if not exists public.media_links (
  id text primary key,
  storage_path text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

-- Email builder templates
create table if not exists public.email_builder_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  content text not null,
  content_format text not null default 'markdown',
  blocks jsonb,
  preview_text text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email campaign definitions
create table if not exists public.email_campaign_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.email_builder_templates(id),
  subject text not null,
  content text not null,
  content_format text not null default 'markdown',
  blocks jsonb,
  target_groups text[],
  target_segments jsonb,
  sendfox_lists integer[],
  scheduled_for timestamptz,
  status text not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email campaign queue
create table if not exists public.email_campaign_queue (
  id bigint generated always as identity primary key,
  campaign_id uuid references public.campaigns(id),
  payload jsonb not null,
  created_by uuid references auth.users(id),
  contact_count integer not null default 0,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending',
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipient_id uuid references public.campaign_recipients(id),
  buyer_id uuid references public.buyers(id),
  to_email text,
  attempts int not null default 0,
  max_attempts int not null default 8,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  locked_by text,
  last_error text,
  last_error_at timestamptz,
  sent_at timestamptz
);

create unique index if not exists email_campaign_queue_campaign_recipient_uniq_idx on public.email_campaign_queue (campaign_id, recipient_id);
create index if not exists email_campaign_queue_scheduled_idx on public.email_campaign_queue (status, scheduled_for);
create index if not exists email_campaign_queue_status_lock_expires_idx on public.email_campaign_queue (status, lock_expires_at);

-- Email events
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text,
  event_type text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  campaign_id uuid references public.campaigns(id),
  recipient_id uuid references public.campaign_recipients(id),
  buyer_id uuid references public.buyers(id),
  message_id text,
  sns_message_id text
);

create index if not exists email_events_provider_id_idx on public.email_events(provider_message_id);
create index if not exists email_events_campaign_idx on public.email_events(campaign_id);
create index if not exists email_events_campaign_event_idx on public.email_events(campaign_id, event_type);
create index if not exists email_events_campaign_created_idx on public.email_events(campaign_id, created_at);
create unique index if not exists email_events_sns_message_id_uniq_idx on public.email_events(sns_message_id);
create index if not exists email_events_campaign_event_created_idx on public.email_events(campaign_id, event_type, created_at desc);
create index if not exists email_events_recipient_event_created_idx on public.email_events(recipient_id, event_type, created_at desc);
create index if not exists email_events_provider_message_created_idx on public.email_events(provider_message_id, created_at desc);

-- SendFox sync metadata
create table if not exists public.sendfox_list_sync_logs (
  id uuid primary key default gen_random_uuid(),
  list_id integer not null,
  group_id uuid,
  status text not null check (status in ('success', 'error', 'dry_run')),
  mismatches integer not null default 0,
  applied boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists sendfox_list_sync_logs_list_idx on public.sendfox_list_sync_logs(list_id);
create index if not exists sendfox_list_sync_logs_created_idx on public.sendfox_list_sync_logs(created_at desc);

create table if not exists public.sendfox_list_mismatches (
  id uuid primary key default gen_random_uuid(),
  list_id integer not null,
  group_id uuid,
  email text not null,
  issue text not null check (issue in ('missing_in_sendfox', 'missing_in_crm')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sendfox_list_mismatches_list_idx on public.sendfox_list_mismatches(list_id);
create index if not exists sendfox_list_mismatches_resolved_idx on public.sendfox_list_mismatches(resolved);
