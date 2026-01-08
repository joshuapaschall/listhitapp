-- Database bootstrap: functions, triggers, and views

-- Unified updated_at helper
create or replace function public.moddatetime() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Backwards-compatible updated_at helper
create or replace function public.update_updated_at_column() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-update updated_at columns
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'profiles','groups','buyers','email_threads','message_threads','sms_templates','email_templates',
    'quick_reply_templates','gmail_tokens','ai_prompts','properties','showings','offers','agents',
    'agent_sessions','agent_active_calls','calls_sessions','org_voice_settings','inbound_numbers',
    'user_integrations','email_builder_templates','email_campaign_definitions','email_campaign_queue',
    'agents_sessions'
  ]) loop
    execute format('drop trigger if exists %I_moddatetime on public.%I', tbl, tbl);
    execute format('create trigger %I_moddatetime before update on public.%I for each row execute procedure public.moddatetime()', tbl, tbl);
  end loop;
end;
$$;

-- Replace groups utility
create or replace function public.replace_groups_for_buyers(
  buyer_ids uuid[],
  target_group_ids uuid[],
  keep_default boolean default false
) returns table(changed_rows int)
language plpgsql as $$
declare
  default_group_id uuid;
  deleted_count int := 0;
  inserted_count int := 0;
  default_count int := 0;
  retain_default boolean := keep_default;
begin
  if retain_default then
    select id into default_group_id from public.groups where slug = 'all' limit 1;
    if default_group_id is null then
      retain_default := false;
    end if;
  end if;

  delete from public.buyer_groups
  where buyer_id = any(buyer_ids)
    and (not retain_default or group_id <> default_group_id);
  get diagnostics deleted_count = row_count;

  insert into public.buyer_groups (buyer_id, group_id)
  select b, g from unnest(buyer_ids) as b cross join unnest(target_group_ids) as g
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if retain_default then
    insert into public.buyer_groups (buyer_id, group_id)
    select b, default_group_id from unnest(buyer_ids) as b
    on conflict do nothing;
    get diagnostics default_count = row_count;
  end if;

  return query select coalesce(deleted_count, 0) + coalesce(inserted_count, 0) + coalesce(default_count, 0);
end;
$$;

-- Agent password verification
create or replace function public.verify_agent_password(agent_email text, password text)
returns table(id uuid, email text, display_name text, sip_username text, telephony_credential_id text, status text)
language plpgsql
security definer
as $$
begin
  return query
  select a.id, a.email, a.display_name, a.sip_username, a.telephony_credential_id, a.status
  from public.agents a
  where a.email = agent_email
    and a.password_hash = crypt(password, a.password_hash);
end;
$$;

-- Handle STOP/unsubscribe keywords
create or replace function public.handle_message_filter() returns trigger
language plpgsql as $$
declare
  kw text;
  matched boolean := false;
begin
  if new.body ~* '\\b(stop|stopall|unsubscribe|cancel|end|quit)\\b' then
    matched := true;
  else
    select keyword into kw from public.negative_keywords where new.body ilike '%' || keyword || '%' limit 1;
    if found then
      matched := true;
    end if;
  end if;

  if matched then
    update public.buyers set can_receive_sms = false where id = new.buyer_id;
    new.filtered := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_message_filter on public.messages;
create trigger trg_handle_message_filter
before insert on public.messages
for each row execute procedure public.handle_message_filter();

-- Profile upsert on auth.user inserts
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, updated_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email), now())
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Email queue claim/retry helpers
create or replace function public.claim_email_queue_jobs(
  p_limit int,
  p_worker text,
  p_lease_seconds int
) returns setof public.email_campaign_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select id
    from public.email_campaign_queue
    where status in ('pending')
      and scheduled_for <= now()
      and (lock_expires_at is null or lock_expires_at < now())
    order by scheduled_for asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  )
  update public.email_campaign_queue q
  set status = 'processing',
      locked_at = now(),
      lock_expires_at = now() + make_interval(secs => coalesce(p_lease_seconds, 0)),
      locked_by = p_worker,
      last_error = null
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

grant execute on function public.claim_email_queue_jobs(int, text, int) to service_role;

drop function if exists public.requeue_stuck_email_jobs(integer, integer);
create or replace function public.requeue_stuck_email_jobs(
  p_stuck_seconds int,
  p_limit int default 50
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count int;
begin
  with candidates as (
    select id
    from public.email_campaign_queue
    where status = 'processing'
      and lock_expires_at is not null
      and lock_expires_at < now() - make_interval(secs => coalesce(p_stuck_seconds, 0))
    order by lock_expires_at asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  ), updated as (
    update public.email_campaign_queue q
    set status = 'pending',
        locked_at = null,
        lock_expires_at = null,
        locked_by = null,
        scheduled_for = now(),
        attempts = q.attempts + 1,
        last_error = 'stuck lease expired',
        last_error_at = now()
    from candidates c
    where q.id = c.id
    returning 1
  )
  select count(*)::int into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.requeue_stuck_email_jobs(int, int) to service_role;

-- Email analytics view + helpers
create or replace view public.campaign_event_metrics as
  select
    campaign_id,
    event_type,
    count(*) as total_events,
    count(distinct recipient_id) as unique_recipients
  from public.email_events
  where campaign_id is not null
  group by campaign_id, event_type;

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
    date_trunc('hour', created_at) as bucket,
    count(*) filter (where event_type = 'open') as opens,
    count(*) filter (where event_type = 'click') as clicks
  from public.email_events
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;

create or replace function public.campaign_recent_events(p_campaign_id uuid)
returns table(at timestamptz, type text, recipient_id uuid, buyer_id uuid, payload jsonb)
stable
language sql as $$
  select
    created_at as at,
    event_type as type,
    recipient_id,
    buyer_id,
    payload
  from public.email_events
  where campaign_id = p_campaign_id
  order by created_at desc
  limit 50;
$$;

create or replace function public.campaign_recipient_summary(p_campaign_id uuid)
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
  from public.campaign_recipients
  where campaign_id = p_campaign_id;
$$;

-- Realtime publication helpers
do $$
declare
  table_name text;
begin
  for table_name in
    select unnest(array[
      'messages',
      'message_threads',
      'active_conferences',
      'campaign_recipients',
      'email_events'
    ])
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
    ) then
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;

      if table_name in ('campaign_recipients', 'email_events') then
        execute format('alter table public.%I replica identity full', table_name);
      end if;
    end if;
  end loop;
end;
$$;
