-- Rollback: remove the site analytics pipeline.
BEGIN;
drop function if exists public.site_analytics_top_pages(uuid, timestamptz, timestamptz);
drop function if exists public.site_analytics_top_sources(uuid, timestamptz, timestamptz);
drop function if exists public.site_analytics_timeseries(uuid, timestamptz, timestamptz, text);
drop function if exists public.site_analytics_summary(uuid, timestamptz, timestamptz);
drop policy if exists site_events_select_own on public.site_events;
drop table if exists public.site_events;
COMMIT;
