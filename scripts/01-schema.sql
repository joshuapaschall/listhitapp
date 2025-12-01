-- DISPOSITION TOOL - INITIAL TABLE SETUP
-- Run this FIRST - Creates core tables used by the application

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text NOT NULL,
  is_protected boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE,
  description text,
  type text NOT NULL DEFAULT 'manual',
  criteria jsonb,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Buyers table
CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fname text,
  lname text,
  full_name text GENERATED ALWAYS AS (coalesce(fname,'') || ' ' || coalesce(lname,'')) STORED,
  email text,
  phone text,
  phone2 text,
  phone3 text,
  company text,
  score integer DEFAULT 0,
  notes text,
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  website text,
  locations text[],
  tags text[],
  vetted boolean DEFAULT false,
  vip boolean DEFAULT false,
  can_receive_sms boolean DEFAULT true,
  can_receive_calls boolean DEFAULT true,
  can_receive_email boolean DEFAULT true,
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
  status text DEFAULT 'lead',
  source text,
  cash_buyer boolean,
  investor boolean,
  owner_financing boolean,
  first_time_buyer boolean,
  sendfox_contact_id integer,
  sendfox_hidden boolean NOT NULL DEFAULT false,
  sendfox_suppressed boolean NOT NULL DEFAULT false,
  sendfox_bounced_at timestamptz,
  sendfox_complained_at timestamptz,
  sendfox_double_opt_in boolean NOT NULL DEFAULT false,
  sendfox_double_opt_in_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Generated columns for normalized email and phone
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS email_norm text GENERATED ALWAYS AS (lower(trim(email))) STORED;

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS phone_norm text GENERATED ALWAYS AS (regexp_replace(phone, '\\D', '', 'g')) STORED;

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS phone2_norm text GENERATED ALWAYS AS (regexp_replace(phone2, '\\D', '', 'g')) STORED;

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS phone3_norm text GENERATED ALWAYS AS (regexp_replace(phone3, '\\D', '', 'g')) STORED;

-- Ensure SendFox hidden flag defaults and indexes exist
ALTER TABLE buyers
  ALTER COLUMN sendfox_hidden SET DEFAULT false;

ALTER TABLE buyers
  ALTER COLUMN sendfox_hidden SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buyers_sendfox_hidden ON buyers(sendfox_hidden);
CREATE INDEX IF NOT EXISTS idx_buyers_deleted_at ON buyers(deleted_at);

-- Unique indexes on normalized fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'buyers' AND indexname = 'buyers_email_norm_idx') THEN
    CREATE UNIQUE INDEX buyers_email_norm_idx ON buyers(email_norm) WHERE email_norm IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'buyers' AND indexname = 'buyers_phone_norm_idx') THEN
    CREATE UNIQUE INDEX buyers_phone_norm_idx ON buyers(phone_norm) WHERE phone_norm IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'buyers' AND indexname = 'buyers_phone2_norm_idx'
  ) THEN
    CREATE INDEX buyers_phone2_norm_idx ON buyers(phone2_norm);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'buyers' AND indexname = 'buyers_phone3_norm_idx'
  ) THEN
    CREATE INDEX buyers_phone3_norm_idx ON buyers(phone3_norm);
  END IF;
END $$;

-- Gmail threads cache table
CREATE TABLE IF NOT EXISTS gmail_threads (
  id text PRIMARY KEY,
  snippet text,
  history_id text,
  starred boolean NOT NULL DEFAULT false,
  unread boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Mapping between Gmail threads and buyers
CREATE TABLE IF NOT EXISTS email_threads (
  thread_id text REFERENCES gmail_threads(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  subject text,
  snippet text,
  starred boolean NOT NULL DEFAULT false,
  unread boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, buyer_id)
);

-- Message threads table groups messages by buyer and phone number
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  preferred_from_number text,
  campaign_id uuid,
  starred boolean NOT NULL DEFAULT false,
  unread boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (buyer_id, phone_number, campaign_id)
);

-- Individual SMS messages linked to threads
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES message_threads(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  direction text NOT NULL,
  from_number text,
  to_number text,
  body text,
  provider_id text,
  media_urls text[],
  is_bulk boolean NOT NULL DEFAULT false,
  filtered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Log of outbound emails tied to buyers
CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  buyer_id uuid NOT NULL,
  subject text,
  preview text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (thread_id, buyer_id)
    REFERENCES email_threads(thread_id, buyer_id)
    ON DELETE CASCADE
);

-- Gmail token storage for OAuth access
CREATE TABLE IF NOT EXISTS gmail_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  access_token text,
  refresh_token text NOT NULL,
  expires_at bigint,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SMS, email, and quick-reply templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quick_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Negative keywords table for filtering messaging content
CREATE TABLE IF NOT EXISTS negative_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'negative_keywords'
      AND indexname = 'negative_keywords_keyword_idx'
  ) THEN
    CREATE UNIQUE INDEX negative_keywords_keyword_idx
      ON negative_keywords(keyword);
  END IF;
END $$;

-- Join table for buyers and groups
CREATE TABLE IF NOT EXISTS buyer_groups (
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (buyer_id, group_id)
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
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
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Property images table
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Join table linking properties to buyers
CREATE TABLE IF NOT EXISTS property_buyers (
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, buyer_id)
);

-- Showings table
CREATE TABLE IF NOT EXISTS showings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  reminder_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Offers table stores all purchase offers from buyers
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  offer_type text,
  offer_price numeric,
  down_payment numeric,
  monthly_payment numeric,
  earnest_money numeric,
  status text NOT NULL DEFAULT 'submitted',
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Campaigns table stores SMS and email marketing campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  channel text NOT NULL,
  subject text,
  message text NOT NULL,
  media_url text,
  buyer_ids uuid[],
  group_ids uuid[],
  send_to_all_numbers boolean NOT NULL DEFAULT true,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  weekday_only boolean,
  run_from time,
  run_until time,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recipients table tracks campaign send status per buyer
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES buyers(id) ON DELETE CASCADE,
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
  unsubscribed_at timestamptz
);

-- Consent logging per SendFox list
CREATE TABLE IF NOT EXISTS buyer_list_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES buyers(id) ON DELETE SET NULL,
  email text NOT NULL,
  email_norm text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  list_id integer NOT NULL,
  double_opt_in boolean NOT NULL DEFAULT false,
  consent_token text,
  consented_at timestamptz,
  confirmed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS buyer_list_consent_token_idx ON buyer_list_consent(consent_token) WHERE consent_token IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'buyer_list_consent_email_list_unique'
  ) THEN
    ALTER TABLE buyer_list_consent
      ADD CONSTRAINT buyer_list_consent_email_list_unique UNIQUE (email_norm, list_id);
  END IF;
END $$;

-- Lookup table storing last SMS sender number for a buyer
CREATE TABLE IF NOT EXISTS buyer_sms_senders (
  buyer_id uuid PRIMARY KEY REFERENCES buyers(id) ON DELETE CASCADE,
  from_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI prompt catalog
CREATE TABLE IF NOT EXISTS ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  permission_key text,
  granted boolean NOT NULL,
  CONSTRAINT permissions_user_key UNIQUE (user_id, permission_key)
);

-- Telnyx credentials
CREATE TABLE IF NOT EXISTS telnyx_credentials (
  id text PRIMARY KEY,
  sip_username text NOT NULL,
  sip_password text NOT NULL,
  connection_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role in ('user','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION create_profile()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles(id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_create_profile'
  ) THEN
    CREATE TRIGGER trg_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_profile();
  END IF;
END $$;

-- Replace groups utility function
CREATE OR REPLACE FUNCTION replace_groups_for_buyers(
  buyer_ids uuid[],
  target_group_ids uuid[],
  keep_default boolean default false
) returns table(changed_rows int) language plpgsql AS $$
declare
  default_group_id uuid;
  deleted_count int := 0;
  inserted_count int := 0;
  default_count int := 0;
  retain_default boolean := keep_default;
begin
  if retain_default then
    select id into default_group_id from groups where slug = 'all' limit 1;
    if default_group_id is null then
      retain_default := false;
    end if;
  end if;

  delete from buyer_groups
  where buyer_id = any(buyer_ids)
    and (not retain_default or group_id <> default_group_id);
  get diagnostics deleted_count = row_count;

  insert into buyer_groups (buyer_id, group_id)
  select b, g
  from unnest(buyer_ids) as b
  cross join unnest(target_group_ids) as g
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if retain_default then
    insert into buyer_groups (buyer_id, group_id)
    select b, default_group_id
    from unnest(buyer_ids) as b
    on conflict do nothing;
    get diagnostics default_count = row_count;
  end if;

  return query
  select (
    coalesce(deleted_count, 0) +
    coalesce(inserted_count, 0) +
    coalesce(default_count, 0)
  )::int as changed_rows;
end;
$$;

-- Voice numbers table for Telnyx integration
CREATE TABLE IF NOT EXISTS public.voice_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  text NOT NULL UNIQUE,
  friendly_name text,
  provider_id   text UNIQUE,
  connection_id text,
  messaging_profile_id text,
  status        text,
  tags          text[],
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_numbers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_numbers'
      AND policyname = 'Read voice numbers'
  ) THEN
    CREATE POLICY "Read voice numbers"
      ON public.voice_numbers
      FOR SELECT
      USING ( auth.role() in ('authenticated','service_role') );
  END IF;
END $$;

INSERT INTO public.voice_numbers (phone_number, friendly_name)
VALUES ('+15551234567', 'Main demo number')
ON CONFLICT DO NOTHING;

-- Utility trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agents table - stores agent credentials and status
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  sip_username text UNIQUE,
  sip_password text,
  telephony_credential_id text,
  status text DEFAULT 'offline' CHECK (status IN ('available','busy','offline')),
  last_call_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent sessions - tracks active WebRTC connections
CREATE TABLE IF NOT EXISTS agent_sessions (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  call_control_id text UNIQUE NOT NULL,
  jwt_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_call_control ON agent_sessions(call_control_id);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents' AND policyname = 'Service role can manage agents'
  ) THEN
    CREATE POLICY "Service role can manage agents" ON agents
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_sessions' AND policyname = 'Service role can manage agent sessions'
  ) THEN
    CREATE POLICY "Service role can manage agent sessions" ON agent_sessions
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION verify_agent_password(agent_email text, password text)
RETURNS TABLE(id uuid, email text, display_name text, sip_username text, telephony_credential_id text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.email, a.display_name, a.sip_username, a.telephony_credential_id, a.status
  FROM agents a
  WHERE a.email = agent_email
    AND a.password_hash = crypt(password, a.password_hash);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agents_updated_at'
  ) THEN
    CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Agent active calls tracks realtime call legs for each agent
CREATE TABLE IF NOT EXISTS agent_active_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid UNIQUE REFERENCES public.agents(id),
  customer_leg_id text,
  agent_leg_id text,
  consult_leg_id text,
  hold_state text DEFAULT 'active',
  playback_state text DEFAULT 'idle',
  last_playback_cmd_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_active_calls_agent ON agent_active_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_active_calls_hold_state ON agent_active_calls(hold_state);

COMMENT ON COLUMN agent_active_calls.hold_state IS 'Current hold state: active | holding';
COMMENT ON COLUMN agent_active_calls.playback_state IS 'Playback state: idle | starting | playing | stopping';
COMMENT ON COLUMN agent_active_calls.last_playback_cmd_id IS 'Last playback command ID for idempotency';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_active_calls_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_active_calls_updated_at
      BEFORE UPDATE ON agent_active_calls
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE agent_active_calls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_active_calls' AND policyname = 'Service role can manage agent_active_calls'
  ) THEN
    CREATE POLICY "Service role can manage agent_active_calls" ON agent_active_calls
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Call transfers keeps a record of warm/cold transfers in progress
CREATE TABLE IF NOT EXISTS call_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_control_id text NOT NULL,
  transfer_type text NOT NULL,
  destination text NOT NULL,
  consult_leg_id text,
  status text NOT NULL DEFAULT 'pending',
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_call_transfers_control_id ON call_transfers(call_control_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_consult_leg ON call_transfers(consult_leg_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_status ON call_transfers(status);

ALTER TABLE call_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'call_transfers' AND policyname = 'Service role can manage call_transfers'
  ) THEN
    CREATE POLICY "Service role can manage call_transfers" ON call_transfers
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Call session map between agent sessions and customer calls
CREATE TABLE IF NOT EXISTS calls_sessions (
  agent_session_id text PRIMARY KEY,
  customer_call_control_id text NOT NULL UNIQUE,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_calls_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_calls_sessions_updated_at
      BEFORE UPDATE ON calls_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE calls_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calls_sessions' AND policyname = 'Service role can manage calls_sessions'
  ) THEN
    CREATE POLICY "Service role can manage calls_sessions" ON calls_sessions
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Agent events stores realtime event payloads
CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_events' AND policyname = 'Service role can manage agent_events'
  ) THEN
    CREATE POLICY "Service role can manage agent_events" ON agent_events
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Calls table for voice logging
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES buyers(id),
  direction text NOT NULL,
  from_number text,
  to_number text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration integer,
  call_sid text UNIQUE,
  recording_url text,
  notes text,
  status text,
  answered_at timestamptz,
  bridged_at timestamptz,
  duration_seconds integer,
  hangup_source text,
  hangup_cause text,
  telnyx_recording_id text,
  recording_state text DEFAULT 'pending',
  recording_duration_seconds integer,
  recording_accessed_at timestamptz,
  recording_accessed_by uuid REFERENCES agents(id),
  searchable tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(from_number,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(to_number,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(status,'')), 'C')
  ) STORED,
  webrtc boolean NOT NULL DEFAULT false,
  from_agent_id uuid REFERENCES agents(id),
  recording_confidence double precision
);

CREATE INDEX IF NOT EXISTS idx_calls_recording_state ON calls(recording_state);
CREATE INDEX IF NOT EXISTS idx_calls_started_at_desc ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_buyer ON calls(buyer_id);
CREATE INDEX IF NOT EXISTS idx_calls_search_gin ON calls USING gin(searchable);
CREATE INDEX IF NOT EXISTS idx_calls_from_trgm ON calls USING gin(from_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_to_trgm ON calls USING gin(to_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_from_agent ON calls(from_agent_id);

-- Create recording access log for audit trail
CREATE TABLE IF NOT EXISTS recording_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text REFERENCES calls(call_sid),
  accessed_by uuid REFERENCES agents(id),
  access_type text CHECK (access_type IN ('play', 'download', 'share')),
  accessed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_recording_access_call ON recording_access_log(call_sid);
CREATE INDEX IF NOT EXISTS idx_recording_access_agent ON recording_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_recording_access_time ON recording_access_log(accessed_at DESC);

COMMENT ON COLUMN calls.telnyx_recording_id IS 'Telnyx recording ID for fetching fresh URLs';
COMMENT ON COLUMN calls.recording_state IS 'State: pending, processing, saved, unavailable';
COMMENT ON COLUMN calls.recording_duration_seconds IS 'Duration of the recording in seconds';
COMMENT ON TABLE recording_access_log IS 'Audit trail for recording access';

-- Performance index for campaign recipient provider IDs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'campaign_recipients'
      AND indexname = 'campaign_recipients_provider_id_idx'
  ) THEN
    CREATE INDEX campaign_recipients_provider_id_idx
      ON campaign_recipients(provider_id);
  END IF;
END $$;

-- Add realtime publication and ensure unique thread index exists when safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'message_threads'
      AND indexname = 'unique_buyer_phone'
  ) THEN
    IF NOT EXISTS (
      SELECT buyer_id, phone_number
      FROM message_threads
      GROUP BY buyer_id, phone_number
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX unique_buyer_phone ON message_threads (buyer_id, phone_number);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'message_threads'
      AND indexname = 'idx_message_threads_preferred_from'
  ) THEN
    CREATE INDEX idx_message_threads_preferred_from ON message_threads (preferred_from_number);
  END IF;
END $$;

-- Add active conferences for realtime conference visibility
CREATE TABLE IF NOT EXISTS public.active_conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id varchar(255) NOT NULL,
  call_sid varchar(255) NOT NULL,
  from_number varchar(50) NOT NULL,
  to_number varchar(50) NOT NULL,
  webrtc_joined boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  ended_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS active_conferences_conference_id_key
  ON public.active_conferences (conference_id);
CREATE INDEX IF NOT EXISTS idx_active_conferences_created_at
  ON public.active_conferences (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_conferences_webrtc_joined
  ON public.active_conferences (webrtc_joined);

ALTER TABLE public.active_conferences ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  has_service_role boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
  );
  has_authenticated_role boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
  );
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'active_conferences'
      AND policyname = 'Service role can do everything'
  ) THEN
    EXECUTE 'DROP POLICY "Service role can do everything" ON public.active_conferences';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'active_conferences'
      AND policyname = 'Authenticated users can read conferences'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated users can read conferences" ON public.active_conferences';
  END IF;

  IF has_service_role THEN
    EXECUTE 'CREATE POLICY "Service role can do everything" '
      'ON public.active_conferences '
      'FOR ALL '
      'TO service_role '
      'USING (true) '
      'WITH CHECK (true)';
  ELSE
    RAISE NOTICE 'Skipping creation of policy "Service role can do everything" because role service_role is missing.';
  END IF;

  IF has_authenticated_role THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read conferences" '
      'ON public.active_conferences '
      'FOR SELECT '
      'TO authenticated '
      'USING (true)';
  ELSE
    RAISE NOTICE 'Skipping creation of policy "Authenticated users can read conferences" because role authenticated is missing.';
  END IF;
END $$;

DO $$
DECLARE
  has_service_role boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
  );
  has_authenticated_role boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
  );
  has_anon_role boolean := EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'anon'
  );
BEGIN
  IF has_service_role THEN
    EXECUTE 'GRANT ALL ON public.active_conferences TO service_role';
  ELSE
    RAISE NOTICE 'Skipping grant to service_role because role is missing.';
  END IF;

  IF has_authenticated_role THEN
    EXECUTE 'GRANT SELECT ON public.active_conferences TO authenticated';
  ELSE
    RAISE NOTICE 'Skipping grant to authenticated because role is missing.';
  END IF;

  IF has_anon_role THEN
    EXECUTE 'GRANT SELECT ON public.active_conferences TO anon';
  ELSE
    RAISE NOTICE 'Skipping grant to anon because role is missing.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'active_conferences'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.active_conferences';
  END IF;
END
$$;

-- Trigger to mark buyers opted out when negative keywords detected
CREATE OR REPLACE FUNCTION handle_message_filter()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kw text;
  matched boolean := false;
BEGIN
  IF new.body ~* '\\b(stop|stopall|unsubscribe|cancel|end|quit)\\b' THEN
    matched := true;
  ELSE
    SELECT keyword INTO kw
    FROM negative_keywords
    WHERE new.body ILIKE '%' || keyword || '%'
    LIMIT 1;
    IF FOUND THEN
      matched := true;
    END IF;
  END IF;

  IF matched THEN
    UPDATE buyers SET can_receive_sms = false WHERE id = new.buyer_id;
    new.filtered := true;
  END IF;

  RETURN new;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_handle_message_filter'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_handle_message_filter ON messages';
  END IF;
  CREATE TRIGGER trg_handle_message_filter
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_filter();
END $$;
