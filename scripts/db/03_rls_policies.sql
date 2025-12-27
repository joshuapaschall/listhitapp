-- Database bootstrap: RLS + policies

-- Enable RLS everywhere and guarantee service_role access
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'active_conferences','agent_active_calls','agent_events','agent_sessions','agents','agents_sessions',
    'buyers','buyer_groups','buyer_list_consent','buyer_sms_senders','campaigns','campaign_recipients',
    'calls','calls_sessions','call_transfers','email_builder_templates','email_campaign_definitions',
    'email_campaign_queue','email_events','email_messages','email_templates','email_threads','gmail_threads',
    'gmail_tokens','groups','inbound_numbers','media_links','messages','message_threads','negative_keywords',
    'offers','organizations','org_voice_settings','permissions','profiles','properties','property_buyers',
    'property_images','quick_reply_templates','recording_access_log','sendfox_list_sync_logs',
    'sendfox_list_mismatches','showings','sms_templates','tags','telnyx_credentials','user_integrations',
    'voice_numbers','ai_prompts'
  ]) loop
    execute format('alter table if exists public.%I enable row level security', tbl);
    execute format('drop policy if exists "service role all on %I" on public.%I', tbl, tbl);
    execute format('create policy "service role all on %I" on public.%I for all to service_role using (true) with check (true)', tbl, tbl);
  end loop;
end;
$$;

-- Authenticated full access tables
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'tags','groups','buyer_groups','buyers','buyer_sms_senders','buyer_list_consent','properties',
    'property_images','property_buyers','showings','offers','gmail_threads','email_threads','email_messages',
    'sms_templates','email_templates','quick_reply_templates','campaigns','campaign_recipients',
    'sendfox_list_sync_logs','sendfox_list_mismatches','ai_prompts','negative_keywords','media_links'
  ]) loop
    execute format('drop policy if exists "authenticated all on %I" on public.%I', tbl, tbl);
    execute format('create policy "authenticated all on %I" on public.%I for all to authenticated using (true) with check (true)', tbl, tbl);
  end loop;
end;
$$;

-- Messages + threads (preserve soft-delete filters)
drop policy if exists "message_threads select active" on public.message_threads;
create policy "message_threads select active" on public.message_threads
  for select to authenticated using (deleted_at is null);

drop policy if exists "message_threads all authenticated" on public.message_threads;
drop policy if exists "message_threads insert authenticated" on public.message_threads;
create policy "message_threads insert authenticated" on public.message_threads
  for insert to authenticated with check (true);

drop policy if exists "message_threads update authenticated" on public.message_threads;
create policy "message_threads update authenticated" on public.message_threads
  for update to authenticated using (true) with check (true);

drop policy if exists "message_threads delete authenticated" on public.message_threads;
create policy "message_threads delete authenticated" on public.message_threads
  for delete to authenticated using (true);

drop policy if exists "messages select active" on public.messages;
create policy "messages select active" on public.messages
  for select to authenticated using (deleted_at is null);

drop policy if exists "messages all authenticated" on public.messages;
drop policy if exists "messages insert authenticated" on public.messages;
create policy "messages insert authenticated" on public.messages
  for insert to authenticated with check (true);

drop policy if exists "messages update authenticated" on public.messages;
create policy "messages update authenticated" on public.messages
  for update to authenticated using (true) with check (true);

drop policy if exists "messages delete authenticated" on public.messages;
create policy "messages delete authenticated" on public.messages
  for delete to authenticated using (true);

-- Voice numbers: readable to authenticated users
drop policy if exists "voice_numbers read" on public.voice_numbers;
create policy "voice_numbers read" on public.voice_numbers
  for select to authenticated using (true);

-- Active conferences readable to authenticated users
drop policy if exists "active_conferences read" on public.active_conferences;
create policy "active_conferences read" on public.active_conferences
  for select to authenticated using (true);

-- Agents: allow authenticated users to fetch their row
drop policy if exists "agent can select own row" on public.agents;
create policy "agent can select own row" on public.agents
  for select to authenticated using (auth.uid() = auth_user_id);

-- Agent presence management
drop policy if exists "agent can manage own presence" on public.agents_sessions;
create policy "agent can manage own presence" on public.agents_sessions
  for all to authenticated
  using (exists (select 1 from public.agents a where a.auth_user_id = auth.uid() and a.id = agent_id))
  with check (exists (select 1 from public.agents a where a.auth_user_id = auth.uid() and a.id = agent_id));

-- Email builder: creators can manage their resources
drop policy if exists "Users manage their email_builder_templates" on public.email_builder_templates;
create policy "Users manage their email_builder_templates" on public.email_builder_templates
  for all to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Users manage their email_campaign_definitions" on public.email_campaign_definitions;
create policy "Users manage their email_campaign_definitions" on public.email_campaign_definitions
  for all to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Users manage their email_campaign_queue" on public.email_campaign_queue;
create policy "Users manage their email_campaign_queue" on public.email_campaign_queue
  for all to authenticated
  using (auth.uid() = created_by or created_by is null)
  with check (auth.uid() = created_by or created_by is null);

-- Email events readable to authenticated users
drop policy if exists "Email events readable" on public.email_events;
create policy "Email events readable" on public.email_events
  for select to authenticated using (true);

-- Permissions: allow owners to view their permissions
drop policy if exists "Users can view their permissions" on public.permissions;
create policy "Users can view their permissions" on public.permissions
  for select to authenticated
  using (auth.uid() = user_id);

-- User integrations: owners can manage their credentials
drop policy if exists "Users manage their user_integrations" on public.user_integrations;
create policy "Users manage their user_integrations" on public.user_integrations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profiles: owner read/write
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- AI prompts: allow authenticated manage
drop policy if exists "Authenticated users can manage ai_prompts" on public.ai_prompts;
create policy "Authenticated users can manage ai_prompts" on public.ai_prompts
  for all to authenticated using (true) with check (true);
