-- =============================================================================
-- ListHit — canonical database baseline
-- =============================================================================
-- Generated 2026-06-04 from a pg_dump --schema-only of the production database
-- (project iracqoqaigaoikpfrklh, Postgres 17.6). This single file recreates the
-- entire public schema: 51 tables, 231 RLS policies, 29 functions, 27 triggers,
-- 124 indexes, and all constraints/foreign keys. It supersedes every file under
-- scripts/db/ (archived) — a fresh database only needs this baseline.
--
-- HOW TO APPLY (fresh Supabase project):
--   Option A (CLI):  supabase db reset            # applies this migration
--   Option B (SQL editor): paste this file and Run
--
-- Two things this schema-only dump cannot carry; see FRESH_ENVIRONMENT_SETUP.md:
--   1. Postgres extensions  -> added explicitly below.
--   2. The trigger on auth.users that creates a profile row on signup
--      (handle_new_user lives in public, but its trigger is on the auth schema)
--      -> restored at the very bottom of this file.
-- =============================================================================

-- ---- Required extensions (not included in a public-only dump) ----------------
-- pg_cron / pg_net were used by the retired Supabase pg_cron scheduler; they are
-- harmless to keep (Vercel cron drives scheduling now). IF NOT EXISTS makes this
-- safe to run against a Supabase project where some are pre-installed.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auth_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $$;


--
-- Name: campaign_engagement_rates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_engagement_rates(p_campaign_id uuid) RETURNS TABLE(delivered bigint, unique_opens bigint, unique_clicks bigint, open_rate numeric, click_rate numeric, ctr numeric)
    LANGUAGE sql STABLE
    AS $$
  with m as (
    select
      count(distinct recipient_id) filter (where event_type='delivery')::bigint as delivered,
      count(distinct recipient_id) filter (where event_type='open')::bigint as unique_opens,
      count(distinct recipient_id) filter (where event_type='click')::bigint as unique_clicks
    from public.email_events
    where campaign_id = p_campaign_id
  )
  select
    delivered,
    unique_opens,
    unique_clicks,
    case when delivered > 0 then unique_opens::numeric / delivered else 0 end as open_rate,
    case when delivered > 0 then unique_clicks::numeric / delivered else 0 end as click_rate,
    case when unique_opens > 0 then unique_clicks::numeric / unique_opens else 0 end as ctr
  from m;
$$;


--
-- Name: campaign_event_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_event_summary(p_campaign_id uuid) RETURNS TABLE(event_type text, total bigint, unique_recipients bigint)
    LANGUAGE sql STABLE
    AS $$
  select event_type, total_events as total, unique_recipients
  from public.campaign_event_metrics
  where campaign_id = p_campaign_id;
$$;


--
-- Name: campaign_event_timeline(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_event_timeline(p_campaign_id uuid) RETURNS TABLE(bucket timestamp with time zone, opens bigint, clicks bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    date_trunc('hour', coalesce(event_ts, created_at)) as bucket,
    count(*) filter (where event_type = 'open') as opens,
    count(*) filter (where event_type = 'click') as clicks
  from public.email_events
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;


--
-- Name: campaign_recent_events(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_recent_events(p_campaign_id uuid) RETURNS TABLE(event_time timestamp with time zone, type text, recipient_id uuid, buyer_id uuid, payload jsonb)
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: campaign_recipient_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_recipient_summary(p_campaign_id uuid) RETURNS TABLE(total bigint, sent bigint, delivered bigint, opened bigint, clicked bigint, bounced bigint, complained bigint, unsubscribed bigint, errors bigint)
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: campaign_sms_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_sms_summary(p_campaign_id uuid) RETURNS TABLE(total bigint, sent bigint, delivered bigint, clicked bigint, replied bigint, failed bigint, undelivered bigint, opted_out bigint, total_cost_usd numeric, total_segments bigint, avg_segments numeric)
    LANGUAGE sql STABLE
    AS $$
  select
    count(*) as total,
    count(*) filter (where sent_at is not null) as sent,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where replied_at is not null) as replied,
    count(*) filter (where rejected_at is not null
      or status in ('delivery_failed','sending_failed','failed','undelivered')) as failed,
    count(*) filter (where delivery_delayed_at is not null
      or status in ('delivery_unconfirmed','unconfirmed')) as undelivered,
    count(*) filter (where unsubscribed_at is not null) as opted_out,
    coalesce(sum(actual_cost_usd), 0) as total_cost_usd,
    coalesce(sum(actual_segments), 0) as total_segments,
    coalesce(avg(actual_segments) filter (where actual_segments is not null), 0) as avg_segments
  from public.campaign_recipients
  where campaign_id = p_campaign_id;
$$;


--
-- Name: campaign_sms_timeline(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_sms_timeline(p_campaign_id uuid) RETURNS TABLE(bucket timestamp with time zone, delivered bigint, clicked bigint, replied bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    date_trunc('hour', coalesce(sent_at, now())) as bucket,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where replied_at is not null) as replied
  from public.campaign_recipients
  where campaign_id = p_campaign_id
  group by bucket
  order by bucket asc;
$$;


--
-- Name: campaign_sms_top_links(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_sms_top_links(p_campaign_id uuid) RETURNS TABLE(target_url text, total_clicks bigint, unique_clickers bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    target_url,
    coalesce(sum(click_count), 0) as total_clicks,
    count(*) filter (where click_count > 0) as unique_clickers
  from public.short_links
  where campaign_id = p_campaign_id
  group by target_url
  order by total_clicks desc
  limit 50;
$$;


--
-- Name: campaign_top_links(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_top_links(p_campaign_id uuid) RETURNS TABLE(url text, total_clicks bigint, unique_clickers bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(payload->'click'->>'url', payload->'click'->>'link') as url,
    count(*) as total_clicks,
    count(distinct recipient_id) as unique_clickers
  from public.email_events
  where campaign_id = p_campaign_id
    and event_type = 'click'
    and coalesce(payload->'click'->>'url', payload->'click'->>'link') is not null
  group by url
  order by total_clicks desc
  limit 50;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_campaign_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaign_queue (
    id bigint NOT NULL,
    campaign_id uuid,
    payload jsonb NOT NULL,
    created_by uuid,
    contact_count integer DEFAULT 0 NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider_id text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_id uuid,
    buyer_id uuid,
    to_email text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 8 NOT NULL,
    locked_at timestamp with time zone,
    lock_expires_at timestamp with time zone,
    locked_by text,
    last_error text,
    last_error_at timestamp with time zone,
    sent_at timestamp with time zone,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: claim_email_queue_jobs(integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_email_queue_jobs(p_limit integer, p_worker text, p_lease_seconds integer) RETURNS SETOF public.email_campaign_queue
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: sms_campaign_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_campaign_queue (
    id bigint NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    buyer_id uuid,
    to_number text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 8 NOT NULL,
    locked_at timestamp with time zone,
    lock_expires_at timestamp with time zone,
    locked_by text,
    last_error text,
    last_error_at timestamp with time zone,
    provider_id text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: claim_sms_queue_jobs(integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_sms_queue_jobs(p_limit integer, p_worker text, p_lease_seconds integer) RETURNS SETOF public.sms_campaign_queue
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  return query
  with candidates as (
    select id
    from public.sms_campaign_queue
    where status in ('pending')
      and scheduled_for <= now()
      and (lock_expires_at is null or lock_expires_at < now())
    order by scheduled_for asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  )
  update public.sms_campaign_queue q
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


--
-- Name: deliverability_report(uuid, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deliverability_report(p_user_id uuid, p_window interval) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  with cutoff as (
    select now() - p_window as since_at
  ),
  scoped_campaigns as (
    select id, name
    from campaigns
    where user_id = p_user_id
  ),
  scoped_recipients as (
    select
      cr.*,
      c.name as campaign_name
    from campaign_recipients cr
    join scoped_campaigns c on c.id = cr.campaign_id
  ),
  recipient_with_last as (
    select
      r.id,
      r.buyer_id,
      r.campaign_name,
      r.status,
      r.error,
      r.sent_at,
      r.delivered_at,
      r.opened_at,
      r.clicked_at,
      r.bounced_at,
      r.complained_at,
      r.unsubscribed_at,
      r.rejected_at,
      r.rendering_failed_at,
      r.delivery_delayed_at,
      nullif(
        greatest(
          coalesce(r.sent_at, 'epoch'::timestamptz),
          coalesce(r.delivered_at, 'epoch'::timestamptz),
          coalesce(r.opened_at, 'epoch'::timestamptz),
          coalesce(r.clicked_at, 'epoch'::timestamptz),
          coalesce(r.bounced_at, 'epoch'::timestamptz),
          coalesce(r.complained_at, 'epoch'::timestamptz),
          coalesce(r.unsubscribed_at, 'epoch'::timestamptz),
          coalesce(r.rejected_at, 'epoch'::timestamptz),
          coalesce(r.rendering_failed_at, 'epoch'::timestamptz),
          coalesce(r.delivery_delayed_at, 'epoch'::timestamptz)
        ),
        'epoch'::timestamptz
      ) as last_event_at
    from scoped_recipients r
  ),
  recipient_window as (
    select *
    from recipient_with_last, cutoff
    where last_event_at >= cutoff.since_at
  ),
  kpis as (
    select
      count(*) filter (where sent_at >= cutoff.since_at) as sent,
      count(*) filter (where delivered_at >= cutoff.since_at) as delivered,
      count(*) filter (where opened_at >= cutoff.since_at) as opens,
      count(*) filter (where clicked_at >= cutoff.since_at) as clicks,
      count(*) filter (where bounced_at >= cutoff.since_at) as bounces,
      count(*) filter (where complained_at >= cutoff.since_at) as complaints,
      count(*) filter (where unsubscribed_at >= cutoff.since_at) as unsubscribes,
      count(*) filter (
        where rejected_at >= cutoff.since_at
          or rendering_failed_at >= cutoff.since_at
      ) as errors
    from scoped_recipients, cutoff
  ),
  recipient_drilldown as (
    select
      b.email as email,
      coalesce(b.full_name, concat_ws(' ', b.fname, b.lname)) as name,
      r.campaign_name as campaign_name,
      r.error as error_message,
      r.last_event_at as last_event_at,
      coalesce(
        (
          select e.event_type
          from email_events e
          where e.recipient_id = r.id
          order by e.created_at desc
          limit 1
        ),
        case
          when r.rejected_at is not null or r.rendering_failed_at is not null then 'error'
          when r.bounced_at is not null then 'bounce'
          when r.complained_at is not null then 'complaint'
          when r.unsubscribed_at is not null then 'unsubscribe'
          when r.clicked_at is not null then 'click'
          when r.opened_at is not null then 'open'
          when r.delivered_at is not null then 'delivery'
          when r.sent_at is not null then 'sent'
          else coalesce(r.status, 'unknown')
        end
      ) as last_status
    from recipient_window r
    left join buyers b on b.id = r.buyer_id
    order by r.last_event_at desc nulls last
    limit 500
  ),
  top_links as (
    select
      e.payload->'click'->>'link' as url,
      count(*) as total_clicks,
      count(distinct e.recipient_id) as unique_clickers
    from email_events e
    join scoped_campaigns c on c.id = e.campaign_id
    join cutoff on true
    where e.created_at >= cutoff.since_at
      and e.event_type = 'click'
      and e.payload->'click'->>'link' is not null
    group by url
    order by total_clicks desc
    limit 50
  ),
  link_clickers as (
    select
      e.payload->'click'->>'link' as url,
      b.email as email,
      coalesce(b.full_name, concat_ws(' ', b.fname, b.lname)) as name,
      e.created_at as clicked_at,
      c.name as campaign_name
    from email_events e
    join scoped_campaigns c on c.id = e.campaign_id
    left join campaign_recipients cr on cr.id = e.recipient_id
    left join buyers b on b.id = cr.buyer_id
    join cutoff on true
    where e.created_at >= cutoff.since_at
      and e.event_type = 'click'
      and e.payload->'click'->>'link' is not null
    order by e.created_at desc
    limit 1000
  )
  select jsonb_build_object(
    'kpis', (select row_to_json(kpis) from kpis),
    'recipients', (select coalesce(jsonb_agg(recipient_drilldown), '[]'::jsonb) from recipient_drilldown),
    'top_links', (select coalesce(jsonb_agg(top_links), '[]'::jsonb) from top_links),
    'link_clickers', (select coalesce(jsonb_agg(link_clickers), '[]'::jsonb) from link_clickers)
  );
$$;


--
-- Name: generate_property_slug(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_property_slug(p_address text, p_city text, p_state text, p_zip text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  base_slug text;
BEGIN
  base_slug := lower(coalesce(p_address,'') || '-' || coalesce(p_city,'') || '-' || coalesce(p_state,'') || '-' || coalesce(p_zip,''));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  RETURN base_slug;
END;
$_$;


--
-- Name: generate_property_slug_base(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_property_slug_base(p_address text, p_city text, p_state text, p_zip text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE base_slug text;
BEGIN
  base_slug := lower(
    coalesce(p_address, '') || '-' ||
    coalesce(p_city, '') || '-' ||
    coalesce(p_state, '') || '-' ||
    coalesce(p_zip, '')
  );
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  RETURN base_slug;
END;
$_$;


--
-- Name: generate_property_slug_unique(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_property_slug_unique(p_property_id uuid, p_address text, p_city text, p_state text, p_zip text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE base_slug text; candidate text; suffix int := 0;
BEGIN
  base_slug := generate_property_slug_base(p_address, p_city, p_state, p_zip);
  IF base_slug = '' THEN RETURN p_property_id::text; END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM properties WHERE slug = candidate AND id <> p_property_id) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  END LOOP;
  RETURN candidate;
END;
$$;


--
-- Name: handle_message_filter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_message_filter() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: moddatetime(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moddatetime() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: record_short_link_click(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_short_link_click(p_link_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_recipient_id uuid;
begin
  update public.short_links
  set
    click_count = click_count + 1,
    last_clicked_at = now(),
    first_clicked_at = coalesce(first_clicked_at, now())
  where id = p_link_id
  returning campaign_recipient_id into v_recipient_id;

  -- Cascade to campaign_recipients.clicked_at (first-write-wins)
  if v_recipient_id is not null then
    update public.campaign_recipients
    set clicked_at = now()
    where id = v_recipient_id
      and clicked_at is null;
  end if;
end;
$$;


--
-- Name: replace_groups_for_buyers(uuid[], uuid[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_groups_for_buyers(buyer_ids uuid[], target_group_ids uuid[], keep_default boolean DEFAULT false) RETURNS TABLE(changed_rows integer)
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: requeue_stuck_email_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.requeue_stuck_email_jobs(p_stuck_seconds integer) RETURNS SETOF public.email_campaign_queue
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  update public.email_campaign_queue q
  set
    status = 'pending',
    locked_at = null,
    lock_expires_at = null,
    locked_by = null,
    attempts = q.attempts + 1,
    last_error = 'stuck lease expired',
    last_error_at = now()
  where q.status = 'processing'
    and q.lock_expires_at is not null
    and q.lock_expires_at < now() - (coalesce(p_stuck_seconds, 0) || ' seconds')::interval
  returning q.*;
$$;


--
-- Name: requeue_stuck_email_jobs(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.requeue_stuck_email_jobs(p_stuck_seconds integer, p_limit integer DEFAULT 50) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: requeue_stuck_sms_jobs(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.requeue_stuck_sms_jobs(p_stuck_seconds integer, p_limit integer DEFAULT 50) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  updated_count int;
begin
  with candidates as (
    select id
    from public.sms_campaign_queue
    where status = 'processing'
      and lock_expires_at is not null
      and lock_expires_at < now() - make_interval(secs => coalesce(p_stuck_seconds, 0))
    order by lock_expires_at asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  ), updated as (
    update public.sms_campaign_queue q
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


--
-- Name: set_campaigns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_campaigns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: set_negative_keywords_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_negative_keywords_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: set_property_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_property_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.slug IS NULL OR (
    TG_OP = 'UPDATE' AND (
      OLD.address IS DISTINCT FROM NEW.address OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.state IS DISTINCT FROM NEW.state OR
      OLD.zip IS DISTINCT FROM NEW.zip
    )
  ) THEN
    NEW.slug := generate_property_slug_unique(NEW.id, NEW.address, NEW.city, NEW.state, NEW.zip);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: short_links_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.short_links_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    prompt text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: buyer_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyer_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    consent_text text NOT NULL,
    consent_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'website_signup'::text NOT NULL,
    source_url text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: buyer_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyer_groups (
    buyer_id uuid NOT NULL,
    group_id uuid NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: buyer_list_consent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyer_list_consent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid,
    email text NOT NULL,
    email_norm text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    list_id integer NOT NULL,
    double_opt_in boolean DEFAULT false NOT NULL,
    consent_token text,
    consented_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: buyer_sms_senders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyer_sms_senders (
    buyer_id uuid NOT NULL,
    from_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: buyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fname text,
    lname text,
    full_name text GENERATED ALWAYS AS (((COALESCE(fname, ''::text) || ' '::text) || COALESCE(lname, ''::text))) STORED,
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
    status text DEFAULT 'lead'::text,
    source text,
    cash_buyer boolean,
    investor boolean,
    owner_financing boolean,
    first_time_buyer boolean,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_norm text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    email_suppressed boolean DEFAULT false NOT NULL,
    email_bounced_at timestamp with time zone,
    email_complained_at timestamp with time zone,
    is_unsubscribed boolean DEFAULT false NOT NULL,
    unsubscribed_at timestamp with time zone,
    sms_suppressed boolean DEFAULT false NOT NULL,
    sms_suppressed_at timestamp with time zone,
    sms_suppressed_reason text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    blocked_at timestamp with time zone,
    blocked_reason text,
    email_suppressed_at timestamp with time zone,
    email_suppressed_reason text,
    phone_norm text GENERATED ALWAYS AS (NULLIF("right"(regexp_replace(COALESCE(phone, ''::text), '[^0-9]'::text, ''::text, 'g'::text), 10), ''::text)) STORED,
    phone2_norm text GENERATED ALWAYS AS (NULLIF("right"(regexp_replace(COALESCE(phone2, ''::text), '[^0-9]'::text, ''::text, 'g'::text), 10), ''::text)) STORED,
    phone3_norm text GENERATED ALWAYS AS (NULLIF("right"(regexp_replace(COALESCE(phone3, ''::text), '[^0-9]'::text, ''::text, 'g'::text), 10), ''::text)) STORED
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid,
    direction text NOT NULL,
    from_number text,
    to_number text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration integer,
    call_sid text,
    recording_url text,
    notes text,
    status text,
    answered_at timestamp with time zone,
    bridged_at timestamp with time zone,
    duration_seconds integer,
    hangup_source text,
    hangup_cause text,
    telnyx_recording_id text,
    recording_state text DEFAULT 'pending'::text,
    recording_duration_seconds integer,
    recording_accessed_at timestamp with time zone,
    recording_accessed_by uuid,
    searchable tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('simple'::regconfig, COALESCE(from_number, ''::text)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, COALESCE(to_number, ''::text)), 'A'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(status, ''::text)), 'C'::"char"))) STORED,
    webrtc boolean DEFAULT false NOT NULL,
    recording_confidence double precision,
    user_id uuid,
    voicemail boolean DEFAULT false NOT NULL,
    voicemail_storage_path text,
    voicemail_duration_seconds integer,
    routing_mode text,
    forwarded_to text,
    forwarded_at timestamp with time zone,
    browser_ring_timeout_at timestamp with time zone,
    call_session_id text,
    browser_answered_at timestamp with time zone,
    voicemail_recording_id text,
    forward_answered_at timestamp with time zone,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: COLUMN calls.telnyx_recording_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calls.telnyx_recording_id IS 'Telnyx recording ID for fetching fresh URLs';


--
-- Name: COLUMN calls.recording_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calls.recording_state IS 'State: pending, processing, saved, unavailable';


--
-- Name: COLUMN calls.recording_duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calls.recording_duration_seconds IS 'Duration of the recording in seconds';


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_message_id text,
    event_type text,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    buyer_id uuid,
    message_id text,
    sns_message_id text,
    event_ts timestamp with time zone,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);

ALTER TABLE ONLY public.email_events REPLICA IDENTITY FULL;


--
-- Name: campaign_event_metrics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.campaign_event_metrics AS
 SELECT campaign_id,
    event_type,
    count(*) AS total_events,
    count(DISTINCT recipient_id) AS unique_recipients
   FROM public.email_events
  WHERE (campaign_id IS NOT NULL)
  GROUP BY campaign_id, event_type;


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    buyer_id uuid,
    sent_at timestamp with time zone,
    provider_id text,
    from_number text,
    short_url_key text,
    short_url text,
    short_slug text,
    shortio_link_id text,
    status text,
    error text,
    opened_at timestamp with time zone,
    bounced_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    clicked_at timestamp with time zone,
    complained_at timestamp with time zone,
    delivered_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rendering_failed_at timestamp with time zone,
    delivery_delayed_at timestamp with time zone,
    actual_cost_usd numeric(10,6),
    actual_segments integer,
    recipient_carrier text,
    replied_at timestamp with time zone,
    bounce_type text,
    line_type text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);

ALTER TABLE ONLY public.campaign_recipients REPLICA IDENTITY FULL;


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    channel text NOT NULL,
    subject text,
    message text,
    media_url text,
    send_to_all_numbers boolean DEFAULT true NOT NULL,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    weekday_only boolean,
    run_from time without time zone,
    run_until time without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    buyer_ids uuid[],
    group_ids uuid[],
    timezone text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    from_name text,
    from_email text,
    design_json jsonb,
    mjml text,
    preview_text text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    property_id uuid,
    segment_id uuid,
    audience_definition jsonb,
    audience_preview_count integer,
    sent_at timestamp with time zone
);


--
-- Name: dispositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    buyer_id uuid,
    accepted_offer_id uuid,
    deal_type text,
    close_type text,
    sale_status text DEFAULT 'pending'::text NOT NULL,
    buy_price numeric,
    sale_price numeric,
    assignment_fee numeric,
    rehab_budget numeric,
    selling_marketed_price numeric,
    closing_expenses numeric,
    emd_amount numeric,
    seller_contract_accepted_date date,
    inspection_period_end date,
    scheduled_close_date date,
    buyer_contract_accepted_date date,
    under_contract_date date,
    under_contract_buyer_date date,
    closing_date date,
    title_agent text,
    title_company text,
    title_received_emd boolean,
    wholesale_checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    marketing_checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dnc_phones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dnc_phones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    normalized_phone text NOT NULL,
    phone_display text,
    reason text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dnc_phones_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'keyword'::text, 'stop'::text, 'imported'::text])))
);


--
-- Name: email_campaign_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaign_content (
    campaign_id uuid NOT NULL,
    subject text,
    html text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: email_campaign_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_campaign_queue ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.email_campaign_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    domain text NOT NULL,
    ses_region text NOT NULL,
    dkim_tokens jsonb DEFAULT '[]'::jsonb NOT NULL,
    dkim_status text DEFAULT 'pending'::text NOT NULL,
    verified_for_sending boolean DEFAULT false NOT NULL,
    mail_from_domain text,
    mail_from_status text DEFAULT 'pending'::text,
    status text DEFAULT 'pending'::text NOT NULL,
    last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id text NOT NULL,
    buyer_id uuid NOT NULL,
    subject text,
    preview text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: email_senders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_senders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    from_email text NOT NULL,
    from_name text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to text
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subject text,
    template_kind text DEFAULT 'template'::text NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    design_json jsonb,
    mjml text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_threads (
    thread_id text NOT NULL,
    buyer_id uuid NOT NULL,
    subject text,
    snippet text,
    starred boolean DEFAULT false NOT NULL,
    unread boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: gmail_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_threads (
    id text NOT NULL,
    snippet text,
    history_id text,
    starred boolean DEFAULT false NOT NULL,
    unread boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: gmail_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_tokens (
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text NOT NULL,
    expires_at bigint,
    email text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    last_sync_error text,
    last_sync_error_at timestamp with time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean DEFAULT false NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    description text,
    type text DEFAULT 'manual'::text NOT NULL,
    criteria jsonb,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: inbound_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_numbers (
    e164 text NOT NULL,
    org_id uuid NOT NULL,
    telnyx_number_id text,
    label text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    call_routing_mode text DEFAULT 'browser_only'::text NOT NULL,
    call_forwarding_number text,
    browser_ring_timeout_seconds integer DEFAULT 20 NOT NULL,
    voicemail_greeting_url text,
    voicemail_greeting_source text,
    market_id uuid,
    config_override boolean DEFAULT false NOT NULL,
    CONSTRAINT inbound_numbers_call_routing_mode_check CHECK ((call_routing_mode = ANY (ARRAY['browser_only'::text, 'browser_first_then_forward'::text, 'forwarding_only'::text]))),
    CONSTRAINT inbound_numbers_voicemail_greeting_source_check CHECK (((voicemail_greeting_source IS NULL) OR (voicemail_greeting_source = ANY (ARRAY['polly'::text, 'recorded'::text]))))
);


--
-- Name: markets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.markets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    purpose text NOT NULL,
    call_routing_mode text DEFAULT 'browser_only'::text NOT NULL,
    call_forwarding_number text,
    browser_ring_timeout_seconds integer DEFAULT 20 NOT NULL,
    voicemail_greeting_url text,
    voicemail_greeting_source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT markets_call_routing_mode_check CHECK ((call_routing_mode = ANY (ARRAY['browser_only'::text, 'browser_first_then_forward'::text, 'forwarding_only'::text]))),
    CONSTRAINT markets_purpose_check CHECK ((purpose = ANY (ARRAY['campaign'::text, 'main'::text]))),
    CONSTRAINT markets_voicemail_greeting_source_check CHECK (((voicemail_greeting_source IS NULL) OR (voicemail_greeting_source = ANY (ARRAY['polly'::text, 'recorded'::text]))))
);


--
-- Name: media_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_links (
    id text NOT NULL,
    storage_path text NOT NULL,
    content_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid,
    phone_number text NOT NULL,
    campaign_id uuid,
    starred boolean DEFAULT false NOT NULL,
    unread boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    preferred_from_number text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    filtered_at timestamp with time zone,
    filtered_keyword_id uuid,
    filter_overridden boolean DEFAULT false NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid,
    buyer_id uuid,
    direction text NOT NULL,
    from_number text,
    to_number text,
    body text,
    provider_id text,
    media_urls text[],
    is_bulk boolean DEFAULT false NOT NULL,
    filtered boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: negative_keywords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negative_keywords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    keyword text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    match_type text DEFAULT 'phrase'::text NOT NULL,
    action text DEFAULT 'hide'::text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT negative_keywords_action_check CHECK ((action = ANY (ARRAY['hide'::text, 'dnc'::text]))),
    CONSTRAINT negative_keywords_match_type_check CHECK ((match_type = ANY (ARRAY['exact'::text, 'phrase'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid,
    property_id uuid,
    offer_type text,
    offer_price numeric,
    down_payment numeric,
    monthly_payment numeric,
    earnest_money numeric,
    status text DEFAULT 'submitted'::text NOT NULL,
    notes text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    countered_at timestamp with time zone,
    closed_at timestamp with time zone,
    due_diligence_days integer,
    proposed_closing_date date,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    accepted_price numeric,
    assignment_fee numeric,
    deal_expenses numeric
);


--
-- Name: org_voice_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_voice_settings (
    org_id uuid NOT NULL,
    fallback_mode text DEFAULT 'dispatcher_sip'::text NOT NULL,
    fallback_sip_username text,
    voicemail_media_url text,
    queue_timeout_secs integer DEFAULT 20 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_voice_settings_fallback_mode_check CHECK ((fallback_mode = ANY (ARRAY['dispatcher_sip'::text, 'ring_all'::text, 'voicemail'::text, 'none'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid,
    business_name text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    country text,
    website_url text,
    phone text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    permission_key text,
    granted boolean NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    display_name text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telnyx_credential_id text,
    sip_username text,
    sip_password text,
    org_id uuid,
    phone text,
    avatar_url text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text, 'owner'::text])))
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    status text DEFAULT 'available'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    buy_price numeric,
    deal_type text DEFAULT 'cash'::text,
    finance_subtype text,
    interest_rate numeric,
    term_months integer,
    balloon_months integer,
    existing_loan_balance numeric,
    lockbox_code text
);


--
-- Name: property_buyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_buyers (
    property_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: property_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid,
    image_url text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: quick_reply_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_reply_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: recording_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recording_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_sid text,
    accessed_by uuid,
    access_type text,
    accessed_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    CONSTRAINT recording_access_log_access_type_check CHECK ((access_type = ANY (ARRAY['play'::text, 'download'::text, 'share'::text])))
);


--
-- Name: TABLE recording_access_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recording_access_log IS 'Audit trail for recording access';


--
-- Name: segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    channel text,
    match text DEFAULT 'all'::text NOT NULL,
    definition jsonb DEFAULT '{"match": "all", "conditions": []}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT segments_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text]))),
    CONSTRAINT segments_match_check CHECK ((match = ANY (ARRAY['all'::text, 'any'::text])))
);


--
-- Name: ses_reputation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ses_reputation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    sending_state text NOT NULL,
    reason text,
    enforcement_status text,
    sending_enabled boolean,
    account_bounce_rate numeric,
    account_complaint_rate numeric,
    window_sent integer,
    raw jsonb
);


--
-- Name: short_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.short_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    domain text NOT NULL,
    target_url text NOT NULL,
    campaign_id uuid,
    campaign_recipient_id uuid,
    property_id uuid,
    created_by uuid,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp with time zone,
    click_count integer DEFAULT 0 NOT NULL,
    first_clicked_at timestamp with time zone,
    last_clicked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL,
    CONSTRAINT short_links_slug_format CHECK ((slug ~ '^[A-Za-z0-9_-]{4,12}$'::text))
);


--
-- Name: showings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.showings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid,
    buyer_id uuid,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_by uuid,
    reminder_sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: sms_campaign_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sms_campaign_queue ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sms_campaign_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    due_date date,
    completed_at timestamp with time zone,
    related_property_id uuid,
    related_buyer_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telnyx_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telnyx_credentials (
    id text NOT NULL,
    sip_username text NOT NULL,
    sip_password text NOT NULL,
    connection_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_presence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sip_username text,
    status text NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    client_id text NOT NULL,
    CONSTRAINT user_presence_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text])))
);


--
-- Name: voice_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    friendly_name text,
    provider_id text,
    connection_id text,
    messaging_profile_id text,
    status text,
    tags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid DEFAULT 'adddfd02-790e-4be7-a0df-047b7dbdd1b8'::uuid NOT NULL
);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: buyer_consents buyer_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_consents
    ADD CONSTRAINT buyer_consents_pkey PRIMARY KEY (id);


--
-- Name: buyer_groups buyer_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_groups
    ADD CONSTRAINT buyer_groups_pkey PRIMARY KEY (buyer_id, group_id);


--
-- Name: buyer_list_consent buyer_list_consent_email_list_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_list_consent
    ADD CONSTRAINT buyer_list_consent_email_list_unique UNIQUE (email_norm, list_id);


--
-- Name: buyer_list_consent buyer_list_consent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_list_consent
    ADD CONSTRAINT buyer_list_consent_pkey PRIMARY KEY (id);


--
-- Name: buyer_sms_senders buyer_sms_senders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_sms_senders
    ADD CONSTRAINT buyer_sms_senders_pkey PRIMARY KEY (buyer_id);


--
-- Name: buyers buyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_pkey PRIMARY KEY (id);


--
-- Name: calls calls_call_sid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_call_sid_key UNIQUE (call_sid);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: dispositions dispositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositions
    ADD CONSTRAINT dispositions_pkey PRIMARY KEY (id);


--
-- Name: dnc_phones dnc_phones_org_id_normalized_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnc_phones
    ADD CONSTRAINT dnc_phones_org_id_normalized_phone_key UNIQUE (org_id, normalized_phone);


--
-- Name: dnc_phones dnc_phones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnc_phones
    ADD CONSTRAINT dnc_phones_pkey PRIMARY KEY (id);


--
-- Name: email_campaign_content email_campaign_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_content
    ADD CONSTRAINT email_campaign_content_pkey PRIMARY KEY (campaign_id);


--
-- Name: email_campaign_queue email_campaign_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_queue
    ADD CONSTRAINT email_campaign_queue_pkey PRIMARY KEY (id);


--
-- Name: email_domains email_domains_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_domains
    ADD CONSTRAINT email_domains_domain_key UNIQUE (domain);


--
-- Name: email_domains email_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_domains
    ADD CONSTRAINT email_domains_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);


--
-- Name: email_senders email_senders_org_id_from_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_senders
    ADD CONSTRAINT email_senders_org_id_from_email_key UNIQUE (org_id, from_email);


--
-- Name: email_senders email_senders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_senders
    ADD CONSTRAINT email_senders_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (thread_id, buyer_id);


--
-- Name: gmail_threads gmail_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_threads
    ADD CONSTRAINT gmail_threads_pkey PRIMARY KEY (id);


--
-- Name: gmail_tokens gmail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_tokens
    ADD CONSTRAINT gmail_tokens_pkey PRIMARY KEY (id);


--
-- Name: groups groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_name_key UNIQUE (name);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: groups groups_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_slug_key UNIQUE (slug);


--
-- Name: inbound_numbers inbound_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_numbers
    ADD CONSTRAINT inbound_numbers_pkey PRIMARY KEY (e164);


--
-- Name: markets markets_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_org_id_name_key UNIQUE (org_id, name);


--
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (id);


--
-- Name: media_links media_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_links
    ADD CONSTRAINT media_links_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_buyer_id_phone_number_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_buyer_id_phone_number_campaign_id_key UNIQUE (buyer_id, phone_number, campaign_id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: negative_keywords negative_keywords_keyword_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negative_keywords
    ADD CONSTRAINT negative_keywords_keyword_key UNIQUE (keyword);


--
-- Name: negative_keywords negative_keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negative_keywords
    ADD CONSTRAINT negative_keywords_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: org_voice_settings org_voice_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_voice_settings
    ADD CONSTRAINT org_voice_settings_pkey PRIMARY KEY (org_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_user_key UNIQUE (user_id, permission_key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_buyers property_buyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_buyers
    ADD CONSTRAINT property_buyers_pkey PRIMARY KEY (property_id, buyer_id);


--
-- Name: property_images property_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_pkey PRIMARY KEY (id);


--
-- Name: quick_reply_templates quick_reply_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_reply_templates
    ADD CONSTRAINT quick_reply_templates_pkey PRIMARY KEY (id);


--
-- Name: recording_access_log recording_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recording_access_log
    ADD CONSTRAINT recording_access_log_pkey PRIMARY KEY (id);


--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_pkey PRIMARY KEY (id);


--
-- Name: ses_reputation_snapshots ses_reputation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ses_reputation_snapshots
    ADD CONSTRAINT ses_reputation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: short_links short_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_pkey PRIMARY KEY (id);


--
-- Name: short_links short_links_unique_domain_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_unique_domain_slug UNIQUE (domain, slug);


--
-- Name: showings showings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.showings
    ADD CONSTRAINT showings_pkey PRIMARY KEY (id);


--
-- Name: sms_campaign_queue sms_campaign_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaign_queue
    ADD CONSTRAINT sms_campaign_queue_pkey PRIMARY KEY (id);


--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telnyx_credentials telnyx_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telnyx_credentials
    ADD CONSTRAINT telnyx_credentials_pkey PRIMARY KEY (id);


--
-- Name: user_integrations user_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_pkey PRIMARY KEY (id);


--
-- Name: user_integrations user_integrations_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_user_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_client_id_key UNIQUE (user_id, client_id);


--
-- Name: voice_numbers voice_numbers_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_numbers
    ADD CONSTRAINT voice_numbers_phone_number_key UNIQUE (phone_number);


--
-- Name: voice_numbers voice_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_numbers
    ADD CONSTRAINT voice_numbers_pkey PRIMARY KEY (id);


--
-- Name: voice_numbers voice_numbers_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_numbers
    ADD CONSTRAINT voice_numbers_provider_id_key UNIQUE (provider_id);


--
-- Name: ai_prompts_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_prompts_org_id_idx ON public.ai_prompts USING btree (org_id);


--
-- Name: buyer_consents_buyer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_consents_buyer_id_idx ON public.buyer_consents USING btree (buyer_id);


--
-- Name: buyer_consents_consent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_consents_consent_at_idx ON public.buyer_consents USING btree (consent_at DESC);


--
-- Name: buyer_consents_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_consents_org_id_idx ON public.buyer_consents USING btree (org_id);


--
-- Name: buyer_groups_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_groups_org_id_idx ON public.buyer_groups USING btree (org_id);


--
-- Name: buyer_list_consent_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_list_consent_org_id_idx ON public.buyer_list_consent USING btree (org_id);


--
-- Name: buyer_list_consent_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX buyer_list_consent_token_idx ON public.buyer_list_consent USING btree (consent_token) WHERE (consent_token IS NOT NULL);


--
-- Name: buyer_sms_senders_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyer_sms_senders_org_id_idx ON public.buyer_sms_senders USING btree (org_id);


--
-- Name: buyers_blocked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyers_blocked_at_idx ON public.buyers USING btree (blocked_at) WHERE (blocked_at IS NOT NULL);


--
-- Name: buyers_email_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX buyers_email_norm_idx ON public.buyers USING btree (email_norm) WHERE (email_norm IS NOT NULL);


--
-- Name: buyers_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyers_org_id_idx ON public.buyers USING btree (org_id);


--
-- Name: buyers_phone2_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyers_phone2_norm_idx ON public.buyers USING btree (phone2_norm);


--
-- Name: buyers_phone3_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buyers_phone3_norm_idx ON public.buyers USING btree (phone3_norm);


--
-- Name: buyers_phone_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX buyers_phone_norm_idx ON public.buyers USING btree (phone_norm) WHERE (phone_norm IS NOT NULL);


--
-- Name: calls_buyer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_buyer_idx ON public.calls USING btree (buyer_id);


--
-- Name: calls_from_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_from_trgm_idx ON public.calls USING gin (from_number public.gin_trgm_ops);


--
-- Name: calls_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_org_id_idx ON public.calls USING btree (org_id);


--
-- Name: calls_recording_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_recording_state_idx ON public.calls USING btree (recording_state);


--
-- Name: calls_search_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_search_gin_idx ON public.calls USING gin (searchable);


--
-- Name: calls_started_at_desc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_started_at_desc_idx ON public.calls USING btree (started_at DESC);


--
-- Name: calls_to_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_to_trgm_idx ON public.calls USING gin (to_number public.gin_trgm_ops);


--
-- Name: calls_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_user_id_idx ON public.calls USING btree (user_id);


--
-- Name: campaign_recipients_buyer_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_recipients_buyer_from_idx ON public.campaign_recipients USING btree (buyer_id, from_number, sent_at DESC NULLS LAST);


--
-- Name: campaign_recipients_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_recipients_org_id_idx ON public.campaign_recipients USING btree (org_id);


--
-- Name: campaign_recipients_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_recipients_provider_id_idx ON public.campaign_recipients USING btree (provider_id);


--
-- Name: campaigns_org_channel_sent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_org_channel_sent_at_idx ON public.campaigns USING btree (org_id, channel, sent_at DESC) WHERE (sent_at IS NOT NULL);


--
-- Name: campaigns_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_org_id_idx ON public.campaigns USING btree (org_id);


--
-- Name: campaigns_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_property_id_idx ON public.campaigns USING btree (property_id);


--
-- Name: campaigns_segment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_segment_id_idx ON public.campaigns USING btree (segment_id);


--
-- Name: dispositions_closing_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositions_closing_date_idx ON public.dispositions USING btree (closing_date);


--
-- Name: dispositions_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositions_org_id_idx ON public.dispositions USING btree (org_id);


--
-- Name: dispositions_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositions_property_id_idx ON public.dispositions USING btree (property_id);


--
-- Name: dispositions_sale_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositions_sale_status_idx ON public.dispositions USING btree (sale_status);


--
-- Name: dnc_phones_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dnc_phones_org_idx ON public.dnc_phones USING btree (org_id);


--
-- Name: email_campaign_content_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaign_content_org_id_idx ON public.email_campaign_content USING btree (org_id);


--
-- Name: email_campaign_queue_campaign_recipient_uniq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_campaign_queue_campaign_recipient_uniq_idx ON public.email_campaign_queue USING btree (campaign_id, recipient_id) WHERE (recipient_id IS NOT NULL);


--
-- Name: email_campaign_queue_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaign_queue_org_id_idx ON public.email_campaign_queue USING btree (org_id);


--
-- Name: email_campaign_queue_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaign_queue_scheduled_idx ON public.email_campaign_queue USING btree (status, scheduled_for);


--
-- Name: email_campaign_queue_status_lock_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaign_queue_status_lock_expires_idx ON public.email_campaign_queue USING btree (status, lock_expires_at);


--
-- Name: email_campaign_queue_status_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaign_queue_status_scheduled_idx ON public.email_campaign_queue USING btree (status, scheduled_for);


--
-- Name: email_domains_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_domains_org_id_idx ON public.email_domains USING btree (org_id);


--
-- Name: email_events_campaign_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_created_idx ON public.email_events USING btree (campaign_id, created_at);


--
-- Name: email_events_campaign_event_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_event_created_idx ON public.email_events USING btree (campaign_id, event_type, created_at DESC);


--
-- Name: email_events_campaign_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_event_idx ON public.email_events USING btree (campaign_id, event_type);


--
-- Name: email_events_campaign_event_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_event_ts_idx ON public.email_events USING btree (campaign_id, event_ts);


--
-- Name: email_events_campaign_event_type_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_event_type_ts_idx ON public.email_events USING btree (campaign_id, event_type, event_ts DESC);


--
-- Name: email_events_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_idx ON public.email_events USING btree (campaign_id);


--
-- Name: email_events_campaign_type_event_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_campaign_type_event_ts_idx ON public.email_events USING btree (campaign_id, event_type, event_ts DESC);


--
-- Name: email_events_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_org_id_idx ON public.email_events USING btree (org_id);


--
-- Name: email_events_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_provider_id_idx ON public.email_events USING btree (provider_message_id);


--
-- Name: email_events_provider_message_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_provider_message_created_idx ON public.email_events USING btree (provider_message_id, created_at DESC);


--
-- Name: email_events_recipient_event_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_recipient_event_created_idx ON public.email_events USING btree (recipient_id, event_type, created_at DESC);


--
-- Name: email_events_sns_message_id_uniq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_events_sns_message_id_uniq_idx ON public.email_events USING btree (sns_message_id);


--
-- Name: email_messages_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_messages_org_id_idx ON public.email_messages USING btree (org_id);


--
-- Name: email_senders_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_senders_domain_id_idx ON public.email_senders USING btree (domain_id);


--
-- Name: email_senders_one_default_per_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_senders_one_default_per_org_idx ON public.email_senders USING btree (org_id) WHERE (is_default = true);


--
-- Name: email_senders_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_senders_org_id_idx ON public.email_senders USING btree (org_id);


--
-- Name: email_templates_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_templates_org_id_idx ON public.email_templates USING btree (org_id);


--
-- Name: email_threads_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_threads_org_id_idx ON public.email_threads USING btree (org_id);


--
-- Name: gmail_threads_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gmail_threads_org_id_idx ON public.gmail_threads USING btree (org_id);


--
-- Name: gmail_tokens_last_synced_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gmail_tokens_last_synced_at_idx ON public.gmail_tokens USING btree (last_synced_at);


--
-- Name: gmail_tokens_one_active_per_user_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gmail_tokens_one_active_per_user_uniq ON public.gmail_tokens USING btree (user_id) WHERE (is_active = true);


--
-- Name: gmail_tokens_sync_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gmail_tokens_sync_due_idx ON public.gmail_tokens USING btree (sync_enabled, last_synced_at);


--
-- Name: gmail_tokens_user_email_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gmail_tokens_user_email_uniq ON public.gmail_tokens USING btree (user_id, email);


--
-- Name: groups_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_org_id_idx ON public.groups USING btree (org_id);


--
-- Name: idx_buyers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_deleted_at ON public.buyers USING btree (deleted_at);


--
-- Name: idx_calls_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_buyer ON public.calls USING btree (buyer_id);


--
-- Name: idx_calls_call_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_call_session_id ON public.calls USING btree (call_session_id);


--
-- Name: idx_calls_from_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_from_trgm ON public.calls USING gin (from_number public.gin_trgm_ops);


--
-- Name: idx_calls_recording_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_recording_state ON public.calls USING btree (recording_state);


--
-- Name: idx_calls_search_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_search_gin ON public.calls USING gin (searchable);


--
-- Name: idx_calls_started_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_started_at_desc ON public.calls USING btree (started_at DESC);


--
-- Name: idx_calls_to_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_to_trgm ON public.calls USING gin (to_number public.gin_trgm_ops);


--
-- Name: idx_calls_voicemail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_voicemail ON public.calls USING btree (voicemail) WHERE (voicemail = true);


--
-- Name: idx_inbound_numbers_market_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_numbers_market_id ON public.inbound_numbers USING btree (market_id);


--
-- Name: idx_markets_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markets_org_id ON public.markets USING btree (org_id);


--
-- Name: idx_message_threads_preferred_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_preferred_from ON public.message_threads USING btree (preferred_from_number);


--
-- Name: idx_property_images_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_images_featured ON public.property_images USING btree (property_id, is_featured) WHERE (is_featured = true);


--
-- Name: idx_recording_access_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recording_access_agent ON public.recording_access_log USING btree (accessed_by);


--
-- Name: idx_recording_access_call; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recording_access_call ON public.recording_access_log USING btree (call_sid);


--
-- Name: idx_recording_access_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recording_access_time ON public.recording_access_log USING btree (accessed_at DESC);


--
-- Name: idx_threads_preferred_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_preferred_from ON public.message_threads USING btree (preferred_from_number);


--
-- Name: media_links_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_links_org_id_idx ON public.media_links USING btree (org_id);


--
-- Name: message_threads_filtered_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_threads_filtered_at_idx ON public.message_threads USING btree (filtered_at) WHERE (filtered_at IS NOT NULL);


--
-- Name: message_threads_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_threads_org_id_idx ON public.message_threads USING btree (org_id);


--
-- Name: messages_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_org_id_idx ON public.messages USING btree (org_id);


--
-- Name: negative_keywords_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX negative_keywords_org_id_idx ON public.negative_keywords USING btree (org_id);


--
-- Name: negative_keywords_org_keyword_match_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX negative_keywords_org_keyword_match_unique ON public.negative_keywords USING btree (org_id, lower(TRIM(BOTH FROM keyword)), match_type);


--
-- Name: notifications_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_org_id_idx ON public.notifications USING btree (org_id);


--
-- Name: offers_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offers_org_id_idx ON public.offers USING btree (org_id);


--
-- Name: permissions_user_id_permission_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_user_id_permission_key_idx ON public.permissions USING btree (user_id, permission_key);


--
-- Name: profiles_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_org_id_idx ON public.profiles USING btree (org_id);


--
-- Name: profiles_sip_username_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_sip_username_unique_idx ON public.profiles USING btree (sip_username) WHERE (sip_username IS NOT NULL);


--
-- Name: properties_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX properties_org_id_idx ON public.properties USING btree (org_id);


--
-- Name: properties_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX properties_slug_idx ON public.properties USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: property_buyers_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX property_buyers_org_id_idx ON public.property_buyers USING btree (org_id);


--
-- Name: property_images_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX property_images_org_id_idx ON public.property_images USING btree (org_id);


--
-- Name: quick_reply_templates_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quick_reply_templates_org_id_idx ON public.quick_reply_templates USING btree (org_id);


--
-- Name: recording_access_agent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recording_access_agent_idx ON public.recording_access_log USING btree (accessed_by);


--
-- Name: recording_access_call_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recording_access_call_idx ON public.recording_access_log USING btree (call_sid);


--
-- Name: recording_access_log_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recording_access_log_org_id_idx ON public.recording_access_log USING btree (org_id);


--
-- Name: recording_access_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recording_access_time_idx ON public.recording_access_log USING btree (accessed_at DESC);


--
-- Name: segments_org_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX segments_org_active_idx ON public.segments USING btree (org_id, deleted_at);


--
-- Name: segments_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX segments_org_id_idx ON public.segments USING btree (org_id);


--
-- Name: ses_reputation_snapshots_captured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ses_reputation_snapshots_captured_idx ON public.ses_reputation_snapshots USING btree (captured_at DESC);


--
-- Name: short_links_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_campaign_id_idx ON public.short_links USING btree (campaign_id);


--
-- Name: short_links_campaign_recipient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_campaign_recipient_id_idx ON public.short_links USING btree (campaign_recipient_id);


--
-- Name: short_links_domain_slug_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_domain_slug_lookup_idx ON public.short_links USING btree (domain, slug);


--
-- Name: short_links_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_org_id_idx ON public.short_links USING btree (org_id);


--
-- Name: short_links_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_property_id_idx ON public.short_links USING btree (property_id);


--
-- Name: short_links_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX short_links_tags_idx ON public.short_links USING gin (tags);


--
-- Name: showings_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX showings_org_id_idx ON public.showings USING btree (org_id);


--
-- Name: sms_campaign_queue_campaign_recipient_to_number_uniq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_campaign_queue_campaign_recipient_to_number_uniq_idx ON public.sms_campaign_queue USING btree (campaign_id, recipient_id, to_number);


--
-- Name: sms_campaign_queue_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_campaign_queue_org_id_idx ON public.sms_campaign_queue USING btree (org_id);


--
-- Name: sms_campaign_queue_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_campaign_queue_scheduled_idx ON public.sms_campaign_queue USING btree (status, scheduled_for);


--
-- Name: sms_campaign_queue_status_lock_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_campaign_queue_status_lock_expires_idx ON public.sms_campaign_queue USING btree (status, lock_expires_at);


--
-- Name: sms_templates_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_templates_org_id_idx ON public.sms_templates USING btree (org_id);


--
-- Name: tasks_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_due_date_idx ON public.tasks USING btree (due_date);


--
-- Name: tasks_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_org_id_idx ON public.tasks USING btree (org_id);


--
-- Name: uniq_anon_thread_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_anon_thread_org_phone ON public.message_threads USING btree (org_id, phone_number) WHERE (buyer_id IS NULL);


--
-- Name: uniq_email_campaign_queue_campaign_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_email_campaign_queue_campaign_recipient ON public.email_campaign_queue USING btree (campaign_id, recipient_id);


--
-- Name: unique_buyer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_buyer_phone ON public.message_threads USING btree (buyer_id, phone_number);


--
-- Name: user_presence_online_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_presence_online_idx ON public.user_presence USING btree (status, last_seen DESC);


--
-- Name: voice_numbers_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voice_numbers_org_id_idx ON public.voice_numbers USING btree (org_id);


--
-- Name: ai_prompts ai_prompts_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_prompts_moddatetime BEFORE UPDATE ON public.ai_prompts FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: buyers buyers_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER buyers_moddatetime BEFORE UPDATE ON public.buyers FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: email_campaign_queue email_campaign_queue_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_campaign_queue_moddatetime BEFORE UPDATE ON public.email_campaign_queue FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: email_campaign_queue email_campaign_queue_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_campaign_queue_touch BEFORE UPDATE ON public.email_campaign_queue FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: email_templates email_templates_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_moddatetime BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: email_threads email_threads_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_threads_moddatetime BEFORE UPDATE ON public.email_threads FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: gmail_tokens gmail_tokens_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER gmail_tokens_moddatetime BEFORE UPDATE ON public.gmail_tokens FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: groups groups_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER groups_moddatetime BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: inbound_numbers inbound_numbers_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inbound_numbers_moddatetime BEFORE UPDATE ON public.inbound_numbers FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: inbound_numbers inbound_numbers_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inbound_numbers_touch BEFORE UPDATE ON public.inbound_numbers FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: message_threads message_threads_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_threads_moddatetime BEFORE UPDATE ON public.message_threads FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: offers offers_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER offers_moddatetime BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: org_voice_settings org_voice_settings_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_voice_settings_moddatetime BEFORE UPDATE ON public.org_voice_settings FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: org_voice_settings org_voice_settings_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_voice_settings_touch BEFORE UPDATE ON public.org_voice_settings FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: profiles profiles_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_moddatetime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: properties properties_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER properties_moddatetime BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: quick_reply_templates quick_reply_templates_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_reply_templates_moddatetime BEFORE UPDATE ON public.quick_reply_templates FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: short_links short_links_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER short_links_updated_at_trigger BEFORE UPDATE ON public.short_links FOR EACH ROW EXECUTE FUNCTION public.short_links_set_updated_at();


--
-- Name: showings showings_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER showings_moddatetime BEFORE UPDATE ON public.showings FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: sms_campaign_queue sms_campaign_queue_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_campaign_queue_moddatetime BEFORE UPDATE ON public.sms_campaign_queue FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: sms_templates sms_templates_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_templates_moddatetime BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: campaigns trg_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_campaigns_updated_at();


--
-- Name: messages trg_handle_message_filter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_handle_message_filter BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_message_filter();


--
-- Name: negative_keywords trg_negative_keywords_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_negative_keywords_updated_at BEFORE UPDATE ON public.negative_keywords FOR EACH ROW EXECUTE FUNCTION public.set_negative_keywords_updated_at();


--
-- Name: properties trg_set_property_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_property_slug BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_property_slug();


--
-- Name: user_integrations user_integrations_moddatetime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_integrations_moddatetime BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: user_integrations user_integrations_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_integrations_touch BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.moddatetime();


--
-- Name: ai_prompts ai_prompts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: buyer_consents buyer_consents_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_consents
    ADD CONSTRAINT buyer_consents_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: buyer_consents buyer_consents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_consents
    ADD CONSTRAINT buyer_consents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: buyer_groups buyer_groups_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_groups
    ADD CONSTRAINT buyer_groups_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: buyer_groups buyer_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_groups
    ADD CONSTRAINT buyer_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: buyer_groups buyer_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_groups
    ADD CONSTRAINT buyer_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: buyer_list_consent buyer_list_consent_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_list_consent
    ADD CONSTRAINT buyer_list_consent_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: buyer_list_consent buyer_list_consent_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_list_consent
    ADD CONSTRAINT buyer_list_consent_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: buyer_sms_senders buyer_sms_senders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_sms_senders
    ADD CONSTRAINT buyer_sms_senders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: buyer_sms_senders buyer_sms_senders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_sms_senders
    ADD CONSTRAINT buyer_sms_senders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: buyers buyers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: calls calls_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id);


--
-- Name: calls calls_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: calls calls_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: campaign_recipients campaign_recipients_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: campaigns campaigns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: campaigns campaigns_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: campaigns campaigns_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: dispositions dispositions_accepted_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositions
    ADD CONSTRAINT dispositions_accepted_offer_id_fkey FOREIGN KEY (accepted_offer_id) REFERENCES public.offers(id);


--
-- Name: dispositions dispositions_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositions
    ADD CONSTRAINT dispositions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id);


--
-- Name: dispositions dispositions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositions
    ADD CONSTRAINT dispositions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: dispositions dispositions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositions
    ADD CONSTRAINT dispositions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: email_campaign_content email_campaign_content_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_content
    ADD CONSTRAINT email_campaign_content_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_campaign_content email_campaign_content_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_content
    ADD CONSTRAINT email_campaign_content_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_campaign_queue email_campaign_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_queue
    ADD CONSTRAINT email_campaign_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_campaign_queue email_campaign_queue_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_queue
    ADD CONSTRAINT email_campaign_queue_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: email_campaign_queue email_campaign_queue_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_queue
    ADD CONSTRAINT email_campaign_queue_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_campaign_queue email_campaign_queue_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_queue
    ADD CONSTRAINT email_campaign_queue_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: email_domains email_domains_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_domains
    ADD CONSTRAINT email_domains_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_events email_events_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: email_events email_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: email_events email_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_events email_events_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE SET NULL;


--
-- Name: email_messages email_messages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_messages email_messages_thread_id_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_thread_id_buyer_id_fkey FOREIGN KEY (thread_id, buyer_id) REFERENCES public.email_threads(thread_id, buyer_id) ON DELETE CASCADE;


--
-- Name: email_senders email_senders_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_senders
    ADD CONSTRAINT email_senders_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.email_domains(id) ON DELETE CASCADE;


--
-- Name: email_senders email_senders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_senders
    ADD CONSTRAINT email_senders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_threads email_threads_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: email_threads email_threads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: email_threads email_threads_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.gmail_threads(id) ON DELETE CASCADE;


--
-- Name: gmail_threads gmail_threads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_threads
    ADD CONSTRAINT gmail_threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: gmail_tokens gmail_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_tokens
    ADD CONSTRAINT gmail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: inbound_numbers inbound_numbers_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_numbers
    ADD CONSTRAINT inbound_numbers_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON DELETE SET NULL;


--
-- Name: inbound_numbers inbound_numbers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_numbers
    ADD CONSTRAINT inbound_numbers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: markets markets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: media_links media_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_links
    ADD CONSTRAINT media_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: message_threads message_threads_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: message_threads message_threads_filtered_keyword_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_filtered_keyword_id_fkey FOREIGN KEY (filtered_keyword_id) REFERENCES public.negative_keywords(id) ON DELETE SET NULL;


--
-- Name: message_threads message_threads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: messages messages_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: messages messages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: negative_keywords negative_keywords_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negative_keywords
    ADD CONSTRAINT negative_keywords_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: offers offers_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: offers offers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: offers offers_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: org_voice_settings org_voice_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_voice_settings
    ADD CONSTRAINT org_voice_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: permissions permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: properties properties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: property_buyers property_buyers_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_buyers
    ADD CONSTRAINT property_buyers_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: property_buyers property_buyers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_buyers
    ADD CONSTRAINT property_buyers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: property_buyers property_buyers_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_buyers
    ADD CONSTRAINT property_buyers_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_images property_images_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: property_images property_images_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: quick_reply_templates quick_reply_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_reply_templates
    ADD CONSTRAINT quick_reply_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: recording_access_log recording_access_log_call_sid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recording_access_log
    ADD CONSTRAINT recording_access_log_call_sid_fkey FOREIGN KEY (call_sid) REFERENCES public.calls(call_sid);


--
-- Name: recording_access_log recording_access_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recording_access_log
    ADD CONSTRAINT recording_access_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: segments segments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: short_links short_links_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: short_links short_links_campaign_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_campaign_recipient_id_fkey FOREIGN KEY (campaign_recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: short_links short_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: short_links short_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: short_links short_links_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: showings showings_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.showings
    ADD CONSTRAINT showings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: showings showings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.showings
    ADD CONSTRAINT showings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: showings showings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.showings
    ADD CONSTRAINT showings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: showings showings_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.showings
    ADD CONSTRAINT showings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: sms_campaign_queue sms_campaign_queue_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaign_queue
    ADD CONSTRAINT sms_campaign_queue_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id);


--
-- Name: sms_campaign_queue sms_campaign_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaign_queue
    ADD CONSTRAINT sms_campaign_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: sms_campaign_queue sms_campaign_queue_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaign_queue
    ADD CONSTRAINT sms_campaign_queue_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: sms_campaign_queue sms_campaign_queue_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaign_queue
    ADD CONSTRAINT sms_campaign_queue_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id);


--
-- Name: sms_templates sms_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tasks tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: tasks tasks_related_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_related_buyer_id_fkey FOREIGN KEY (related_buyer_id) REFERENCES public.buyers(id);


--
-- Name: tasks tasks_related_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_related_property_id_fkey FOREIGN KEY (related_property_id) REFERENCES public.properties(id);


--
-- Name: user_integrations user_integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_presence user_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: voice_numbers voice_numbers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_numbers
    ADD CONSTRAINT voice_numbers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: profiles Profiles are viewable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles Profiles can be inserted by auth service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be inserted by auth service" ON public.profiles FOR INSERT TO supabase_auth_admin WITH CHECK (true);


--
-- Name: profiles Profiles can be inserted by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be inserted by owner" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Profiles can be inserted by self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be inserted by self" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Profiles can be inserted by service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be inserted by service role" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: profiles Profiles can be updated by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be updated by owner" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: ai_prompts Service role can manage ai_prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage ai_prompts" ON public.ai_prompts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gmail_tokens Service role can manage gmail_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage gmail_tokens" ON public.gmail_tokens USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: permissions Service role can manage permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage permissions" ON public.permissions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: recording_access_log Service role can manage recording_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage recording_access_log" ON public.recording_access_log USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: telnyx_credentials Service role can manage telnyx_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage telnyx_credentials" ON public.telnyx_credentials USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: user_integrations Service role can manage user_integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage user_integrations" ON public.user_integrations USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_campaign_queue Service role manages email_campaign_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages email_campaign_queue" ON public.email_campaign_queue USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: permissions Users can view their permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their permissions" ON public.permissions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_presence Users manage own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own presence" ON public.user_presence TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_integrations Users manage their user_integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their user_integrations" ON public.user_integrations TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompts ai_prompts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_org_delete ON public.ai_prompts FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: ai_prompts ai_prompts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_org_insert ON public.ai_prompts FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: ai_prompts ai_prompts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_org_select ON public.ai_prompts FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: ai_prompts ai_prompts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_org_update ON public.ai_prompts FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buyer_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_consents buyer_consents_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_consents_org_delete ON public.buyer_consents FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_consents buyer_consents_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_consents_org_insert ON public.buyer_consents FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_consents buyer_consents_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_consents_org_select ON public.buyer_consents FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_consents buyer_consents_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_consents_org_update ON public.buyer_consents FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buyer_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_groups buyer_groups_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_groups_org_delete ON public.buyer_groups FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_groups buyer_groups_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_groups_org_insert ON public.buyer_groups FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_groups buyer_groups_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_groups_org_select ON public.buyer_groups FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_groups buyer_groups_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_groups_org_update ON public.buyer_groups FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_list_consent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buyer_list_consent ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_list_consent buyer_list_consent_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_list_consent_org_delete ON public.buyer_list_consent FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_list_consent buyer_list_consent_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_list_consent_org_insert ON public.buyer_list_consent FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_list_consent buyer_list_consent_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_list_consent_org_select ON public.buyer_list_consent FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_list_consent buyer_list_consent_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_list_consent_org_update ON public.buyer_list_consent FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_sms_senders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buyer_sms_senders ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_sms_senders buyer_sms_senders_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_sms_senders_org_delete ON public.buyer_sms_senders FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_sms_senders buyer_sms_senders_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_sms_senders_org_insert ON public.buyer_sms_senders FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyer_sms_senders buyer_sms_senders_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_sms_senders_org_select ON public.buyer_sms_senders FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyer_sms_senders buyer_sms_senders_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyer_sms_senders_org_update ON public.buyer_sms_senders FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

--
-- Name: buyers buyers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyers_org_delete ON public.buyers FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyers buyers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyers_org_insert ON public.buyers FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: buyers buyers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyers_org_select ON public.buyers FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: buyers buyers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buyers_org_update ON public.buyers FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

--
-- Name: calls calls_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calls_org_delete ON public.calls FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: calls calls_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calls_org_insert ON public.calls FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: calls calls_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calls_org_select ON public.calls FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: calls calls_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calls_org_update ON public.calls FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_recipients campaign_recipients_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_recipients_org_delete ON public.campaign_recipients FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: campaign_recipients campaign_recipients_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_recipients_org_insert ON public.campaign_recipients FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: campaign_recipients campaign_recipients_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_recipients_org_select ON public.campaign_recipients FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: campaign_recipients campaign_recipients_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_recipients_org_update ON public.campaign_recipients FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns campaigns_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_org_delete ON public.campaigns FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: campaigns campaigns_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_org_insert ON public.campaigns FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: campaigns campaigns_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_org_select ON public.campaigns FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: campaigns campaigns_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_org_update ON public.campaigns FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: dispositions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispositions ENABLE ROW LEVEL SECURITY;

--
-- Name: dispositions dispositions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispositions_org_delete ON public.dispositions FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: dispositions dispositions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispositions_org_insert ON public.dispositions FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: dispositions dispositions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispositions_org_select ON public.dispositions FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: dispositions dispositions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispositions_org_update ON public.dispositions FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: dnc_phones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dnc_phones ENABLE ROW LEVEL SECURITY;

--
-- Name: dnc_phones dnc_phones_org_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dnc_phones_org_rw ON public.dnc_phones USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_campaign_content ENABLE ROW LEVEL SECURITY;

--
-- Name: email_campaign_content email_campaign_content_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_content_org_delete ON public.email_campaign_content FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_content email_campaign_content_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_content_org_insert ON public.email_campaign_content FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_content email_campaign_content_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_content_org_select ON public.email_campaign_content FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_content email_campaign_content_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_content_org_update ON public.email_campaign_content FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_campaign_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: email_campaign_queue email_campaign_queue_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_queue_org_delete ON public.email_campaign_queue FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_queue email_campaign_queue_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_queue_org_insert ON public.email_campaign_queue FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_queue email_campaign_queue_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_queue_org_select ON public.email_campaign_queue FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_campaign_queue email_campaign_queue_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaign_queue_org_update ON public.email_campaign_queue FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: email_domains email_domains service can do all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "email_domains service can do all" ON public.email_domains USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_domains email_domains_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_domains_org_delete ON public.email_domains FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_domains email_domains_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_domains_org_insert ON public.email_domains FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_domains email_domains_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_domains_org_select ON public.email_domains FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_domains email_domains_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_domains_org_update ON public.email_domains FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events email_events_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_events_org_delete ON public.email_events FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_events email_events_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_events_org_insert ON public.email_events FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_events email_events_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_events_org_select ON public.email_events FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_events email_events_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_events_org_update ON public.email_events FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages email_messages_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_org_delete ON public.email_messages FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_messages email_messages_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_org_insert ON public.email_messages FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_messages email_messages_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_org_select ON public.email_messages FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_messages email_messages_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_org_update ON public.email_messages FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_senders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;

--
-- Name: email_senders email_senders service can do all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "email_senders service can do all" ON public.email_senders USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_senders email_senders_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_senders_org_delete ON public.email_senders FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_senders email_senders_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_senders_org_insert ON public.email_senders FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_senders email_senders_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_senders_org_select ON public.email_senders FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_senders email_senders_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_senders_org_update ON public.email_senders FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates email_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_org_delete ON public.email_templates FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_templates email_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_org_insert ON public.email_templates FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_templates email_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_org_select ON public.email_templates FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_templates email_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_org_update ON public.email_templates FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: email_threads email_threads_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_threads_org_delete ON public.email_threads FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_threads email_threads_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_threads_org_insert ON public.email_threads FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: email_threads email_threads_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_threads_org_select ON public.email_threads FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: email_threads email_threads_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_threads_org_update ON public.email_threads FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: gmail_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_threads gmail_threads_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gmail_threads_org_delete ON public.gmail_threads FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: gmail_threads gmail_threads_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gmail_threads_org_insert ON public.gmail_threads FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: gmail_threads gmail_threads_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gmail_threads_org_select ON public.gmail_threads FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: gmail_threads gmail_threads_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gmail_threads_org_update ON public.gmail_threads FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: gmail_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_tokens gmail_tokens_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gmail_tokens_user_all ON public.gmail_tokens TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: groups groups_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_org_delete ON public.groups FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: groups groups_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_org_insert ON public.groups FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: groups groups_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_org_select ON public.groups FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: groups groups_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_org_update ON public.groups FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: inbound_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_numbers inbound_numbers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_numbers_org_delete ON public.inbound_numbers FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: inbound_numbers inbound_numbers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_numbers_org_insert ON public.inbound_numbers FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: inbound_numbers inbound_numbers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_numbers_org_select ON public.inbound_numbers FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: inbound_numbers inbound_numbers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_numbers_org_update ON public.inbound_numbers FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: markets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

--
-- Name: markets markets_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY markets_org_delete ON public.markets FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: markets markets_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY markets_org_insert ON public.markets FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: markets markets_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY markets_org_select ON public.markets FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: markets markets_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY markets_org_update ON public.markets FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: media_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_links ENABLE ROW LEVEL SECURITY;

--
-- Name: media_links media_links_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_links_org_delete ON public.media_links FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: media_links media_links_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_links_org_insert ON public.media_links FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: media_links media_links_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_links_org_select ON public.media_links FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: media_links media_links_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_links_org_update ON public.media_links FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: message_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: message_threads message_threads_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_threads_org_delete ON public.message_threads FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: message_threads message_threads_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_threads_org_insert ON public.message_threads FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: message_threads message_threads_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_threads_org_select ON public.message_threads FOR SELECT TO authenticated USING (((org_id = public.auth_org_id()) AND (deleted_at IS NULL)));


--
-- Name: message_threads message_threads_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_threads_org_update ON public.message_threads FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_org_delete ON public.messages FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: messages messages_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_org_insert ON public.messages FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: messages messages_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_org_select ON public.messages FOR SELECT TO authenticated USING (((org_id = public.auth_org_id()) AND (deleted_at IS NULL)));


--
-- Name: messages messages_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_org_update ON public.messages FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: negative_keywords; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.negative_keywords ENABLE ROW LEVEL SECURITY;

--
-- Name: negative_keywords negative_keywords_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY negative_keywords_org_delete ON public.negative_keywords FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: negative_keywords negative_keywords_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY negative_keywords_org_insert ON public.negative_keywords FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: negative_keywords negative_keywords_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY negative_keywords_org_select ON public.negative_keywords FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: negative_keywords negative_keywords_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY negative_keywords_org_update ON public.negative_keywords FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_org_delete ON public.notifications FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: notifications notifications_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_org_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: notifications notifications_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_org_select ON public.notifications FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: notifications notifications_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_org_update ON public.notifications FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: offers offers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_org_delete ON public.offers FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: offers offers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_org_insert ON public.offers FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: offers offers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_org_select ON public.offers FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: offers offers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_org_update ON public.offers FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: org_voice_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_voice_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: org_voice_settings org_voice_settings_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_voice_settings_org_delete ON public.org_voice_settings FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: org_voice_settings org_voice_settings_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_voice_settings_org_insert ON public.org_voice_settings FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: org_voice_settings org_voice_settings_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_voice_settings_org_select ON public.org_voice_settings FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: org_voice_settings org_voice_settings_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_voice_settings_org_update ON public.org_voice_settings FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_org_select ON public.organizations FOR SELECT TO authenticated USING ((id = public.auth_org_id()));


--
-- Name: organizations organizations_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_org_update ON public.organizations FOR UPDATE TO authenticated USING ((id = public.auth_org_id())) WITH CHECK ((id = public.auth_org_id()));


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_user_all ON public.permissions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: properties properties_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_org_delete ON public.properties FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: properties properties_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_org_insert ON public.properties FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: properties properties_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_org_select ON public.properties FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: properties properties_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_org_update ON public.properties FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: property_buyers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_buyers ENABLE ROW LEVEL SECURITY;

--
-- Name: property_buyers property_buyers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_buyers_org_delete ON public.property_buyers FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: property_buyers property_buyers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_buyers_org_insert ON public.property_buyers FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: property_buyers property_buyers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_buyers_org_select ON public.property_buyers FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: property_buyers property_buyers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_buyers_org_update ON public.property_buyers FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: property_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

--
-- Name: property_images property_images_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_images_org_delete ON public.property_images FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: property_images property_images_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_images_org_insert ON public.property_images FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: property_images property_images_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_images_org_select ON public.property_images FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: property_images property_images_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_images_org_update ON public.property_images FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: quick_reply_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_reply_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_reply_templates quick_reply_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_reply_templates_org_delete ON public.quick_reply_templates FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: quick_reply_templates quick_reply_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_reply_templates_org_insert ON public.quick_reply_templates FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: quick_reply_templates quick_reply_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_reply_templates_org_select ON public.quick_reply_templates FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: quick_reply_templates quick_reply_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_reply_templates_org_update ON public.quick_reply_templates FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: recording_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recording_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: recording_access_log recording_access_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recording_access_log_org_delete ON public.recording_access_log FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: recording_access_log recording_access_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recording_access_log_org_insert ON public.recording_access_log FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: recording_access_log recording_access_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recording_access_log_org_select ON public.recording_access_log FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: recording_access_log recording_access_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recording_access_log_org_update ON public.recording_access_log FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

--
-- Name: segments segments_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY segments_org_delete ON public.segments FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: segments segments_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY segments_org_insert ON public.segments FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: segments segments_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY segments_org_select ON public.segments FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: segments segments_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY segments_org_update ON public.segments FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: inbound_numbers service can do all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service can do all" ON public.inbound_numbers USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: ai_prompts service role all on ai_prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on ai_prompts" ON public.ai_prompts TO service_role USING (true) WITH CHECK (true);


--
-- Name: buyer_consents service role all on buyer_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on buyer_consents" ON public.buyer_consents TO service_role USING (true) WITH CHECK (true);


--
-- Name: buyer_groups service role all on buyer_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on buyer_groups" ON public.buyer_groups TO service_role USING (true) WITH CHECK (true);


--
-- Name: buyer_list_consent service role all on buyer_list_consent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on buyer_list_consent" ON public.buyer_list_consent TO service_role USING (true) WITH CHECK (true);


--
-- Name: buyer_sms_senders service role all on buyer_sms_senders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on buyer_sms_senders" ON public.buyer_sms_senders TO service_role USING (true) WITH CHECK (true);


--
-- Name: buyers service role all on buyers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on buyers" ON public.buyers TO service_role USING (true) WITH CHECK (true);


--
-- Name: calls service role all on calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on calls" ON public.calls TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_recipients service role all on campaign_recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on campaign_recipients" ON public.campaign_recipients TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaigns service role all on campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on campaigns" ON public.campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_campaign_queue service role all on email_campaign_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on email_campaign_queue" ON public.email_campaign_queue TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_events service role all on email_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on email_events" ON public.email_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_messages service role all on email_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on email_messages" ON public.email_messages TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_templates service role all on email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on email_templates" ON public.email_templates TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_threads service role all on email_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on email_threads" ON public.email_threads TO service_role USING (true) WITH CHECK (true);


--
-- Name: gmail_threads service role all on gmail_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on gmail_threads" ON public.gmail_threads TO service_role USING (true) WITH CHECK (true);


--
-- Name: gmail_tokens service role all on gmail_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on gmail_tokens" ON public.gmail_tokens TO service_role USING (true) WITH CHECK (true);


--
-- Name: groups service role all on groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on groups" ON public.groups TO service_role USING (true) WITH CHECK (true);


--
-- Name: inbound_numbers service role all on inbound_numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on inbound_numbers" ON public.inbound_numbers TO service_role USING (true) WITH CHECK (true);


--
-- Name: media_links service role all on media_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on media_links" ON public.media_links TO service_role USING (true) WITH CHECK (true);


--
-- Name: message_threads service role all on message_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on message_threads" ON public.message_threads TO service_role USING (true) WITH CHECK (true);


--
-- Name: messages service role all on messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on messages" ON public.messages TO service_role USING (true) WITH CHECK (true);


--
-- Name: negative_keywords service role all on negative_keywords; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on negative_keywords" ON public.negative_keywords TO service_role USING (true) WITH CHECK (true);


--
-- Name: offers service role all on offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on offers" ON public.offers TO service_role USING (true) WITH CHECK (true);


--
-- Name: org_voice_settings service role all on org_voice_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on org_voice_settings" ON public.org_voice_settings TO service_role USING (true) WITH CHECK (true);


--
-- Name: organizations service role all on organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on organizations" ON public.organizations TO service_role USING (true) WITH CHECK (true);


--
-- Name: permissions service role all on permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on permissions" ON public.permissions TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles service role all on profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on profiles" ON public.profiles TO service_role USING (true) WITH CHECK (true);


--
-- Name: properties service role all on properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on properties" ON public.properties TO service_role USING (true) WITH CHECK (true);


--
-- Name: property_buyers service role all on property_buyers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on property_buyers" ON public.property_buyers TO service_role USING (true) WITH CHECK (true);


--
-- Name: property_images service role all on property_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on property_images" ON public.property_images TO service_role USING (true) WITH CHECK (true);


--
-- Name: quick_reply_templates service role all on quick_reply_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on quick_reply_templates" ON public.quick_reply_templates TO service_role USING (true) WITH CHECK (true);


--
-- Name: recording_access_log service role all on recording_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on recording_access_log" ON public.recording_access_log TO service_role USING (true) WITH CHECK (true);


--
-- Name: showings service role all on showings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on showings" ON public.showings TO service_role USING (true) WITH CHECK (true);


--
-- Name: sms_templates service role all on sms_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on sms_templates" ON public.sms_templates TO service_role USING (true) WITH CHECK (true);


--
-- Name: tags service role all on tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on tags" ON public.tags TO service_role USING (true) WITH CHECK (true);


--
-- Name: telnyx_credentials service role all on telnyx_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on telnyx_credentials" ON public.telnyx_credentials TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_integrations service role all on user_integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on user_integrations" ON public.user_integrations TO service_role USING (true) WITH CHECK (true);


--
-- Name: voice_numbers service role all on voice_numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role all on voice_numbers" ON public.voice_numbers TO service_role USING (true) WITH CHECK (true);


--
-- Name: ses_reputation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ses_reputation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: short_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

--
-- Name: short_links short_links service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "short_links service role full access" ON public.short_links USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: short_links short_links_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY short_links_org_delete ON public.short_links FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: short_links short_links_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY short_links_org_insert ON public.short_links FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: short_links short_links_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY short_links_org_select ON public.short_links FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: short_links short_links_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY short_links_org_update ON public.short_links FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: showings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.showings ENABLE ROW LEVEL SECURITY;

--
-- Name: showings showings_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY showings_org_delete ON public.showings FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: showings showings_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY showings_org_insert ON public.showings FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: showings showings_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY showings_org_select ON public.showings FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: showings showings_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY showings_org_update ON public.showings FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: sms_campaign_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_campaign_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_campaign_queue sms_campaign_queue_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_campaign_queue_org_delete ON public.sms_campaign_queue FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: sms_campaign_queue sms_campaign_queue_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_campaign_queue_org_insert ON public.sms_campaign_queue FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: sms_campaign_queue sms_campaign_queue_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_campaign_queue_org_select ON public.sms_campaign_queue FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: sms_campaign_queue sms_campaign_queue_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_campaign_queue_org_update ON public.sms_campaign_queue FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_templates sms_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_templates_org_delete ON public.sms_templates FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: sms_templates sms_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_templates_org_insert ON public.sms_templates FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: sms_templates sms_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_templates_org_select ON public.sms_templates FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: sms_templates sms_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_templates_org_update ON public.sms_templates FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: tags tags_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_select_all ON public.tags FOR SELECT TO authenticated USING (true);


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_delete ON public.tasks FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: tasks tasks_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: tasks tasks_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_select ON public.tasks FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: tasks tasks_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_update ON public.tasks FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: telnyx_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telnyx_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: user_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_integrations user_integrations_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_integrations_user_all ON public.user_integrations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: user_presence user_presence_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_presence_service_all ON public.user_presence TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_presence user_presence_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_presence_user_all ON public.user_presence TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: voice_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voice_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_numbers voice_numbers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voice_numbers_org_delete ON public.voice_numbers FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: voice_numbers voice_numbers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voice_numbers_org_insert ON public.voice_numbers FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));


--
-- Name: voice_numbers voice_numbers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voice_numbers_org_select ON public.voice_numbers FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));


--
-- Name: voice_numbers voice_numbers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voice_numbers_org_update ON public.voice_numbers FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));


--
-- PostgreSQL database dump complete
--




-- ---- auth.users signup trigger (captured from production 2026-06-04) ---------
-- Creates a public.profiles row whenever a new auth user signs up. The function
-- public.handle_new_user() is defined above; this trigger lives on the auth
-- schema, so it is NOT part of a public-only dump and is restored here.
-- (Function name is schema-qualified because this file runs with an empty
--  search_path; the raw pg_get_triggerdef output omitted the schema.)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
