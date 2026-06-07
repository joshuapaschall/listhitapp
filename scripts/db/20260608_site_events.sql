-- First-party analytics pipeline for published tenant sites.
-- site_events stores pageviews + lead events; aggregate RPCs power the dashboard.
-- Writes happen via the service role (admin bypasses RLS); owners read their own
-- org's rows via the SELECT policy. Idempotent — safe to re-run.
BEGIN;
create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  org_id uuid not null,
  type text not null check (type in ('pageview','lead')),
  path text,
  referrer text,
  utm_source text, utm_medium text, utm_campaign text,
  visitor_id text,
  created_at timestamptz not null default now()
);
create index if not exists site_events_site_created_idx on public.site_events (site_id, created_at desc);
create index if not exists site_events_org_created_idx on public.site_events (org_id, created_at desc);
create index if not exists site_events_site_type_idx on public.site_events (site_id, type, created_at desc);
alter table public.site_events enable row level security;
-- Owners read their org's events; writes happen via service role (admin bypasses RLS), so no insert policy for anon/auth.
drop policy if exists site_events_select_own on public.site_events;
create policy site_events_select_own on public.site_events for select using (org_id = auth_org_id());

-- Aggregates (SECURITY INVOKER so the SELECT RLS above scopes them to the caller's org).
create or replace function public.site_analytics_summary(p_site_id uuid, p_from timestamptz, p_to timestamptz)
returns table(visits bigint, uniques bigint, signups bigint)
language sql stable as $$
  select
    count(*) filter (where type='pageview'),
    count(distinct visitor_id) filter (where type='pageview'),
    count(*) filter (where type='lead')
  from public.site_events
  where site_id = p_site_id and created_at >= p_from and created_at < p_to;
$$;

create or replace function public.site_analytics_timeseries(p_site_id uuid, p_from timestamptz, p_to timestamptz, p_bucket text)
returns table(bucket timestamptz, visits bigint, signups bigint)
language sql stable as $$
  select date_trunc(p_bucket, created_at) as bucket,
         count(*) filter (where type='pageview'),
         count(*) filter (where type='lead')
  from public.site_events
  where site_id = p_site_id and created_at >= p_from and created_at < p_to
  group by 1 order by 1;
$$;

create or replace function public.site_analytics_top_sources(p_site_id uuid, p_from timestamptz, p_to timestamptz)
returns table(source text, visits bigint, signups bigint)
language sql stable as $$
  select
    coalesce(nullif(utm_source,''),
      case
        when referrer ilike '%google.%' then 'Organic search'
        when referrer ilike '%bing.%' then 'Organic search'
        when referrer ilike '%facebook.%' or referrer ilike '%fb.%' then 'Facebook'
        when referrer is null or referrer='' then 'Direct'
        else 'Referral'
      end) as source,
    count(*) filter (where type='pageview'),
    count(*) filter (where type='lead')
  from public.site_events
  where site_id = p_site_id and created_at >= p_from and created_at < p_to
  group by 1 order by 2 desc nulls last limit 8;
$$;

create or replace function public.site_analytics_top_pages(p_site_id uuid, p_from timestamptz, p_to timestamptz)
returns table(path text, visits bigint, signups bigint)
language sql stable as $$
  select coalesce(nullif(path,''),'/'),
         count(*) filter (where type='pageview'),
         count(*) filter (where type='lead')
  from public.site_events
  where site_id = p_site_id and created_at >= p_from and created_at < p_to
  group by 1 order by 2 desc limit 8;
$$;
COMMIT;
