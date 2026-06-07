-- Owner market focus (scope + market list) for the site builder. Drives
-- geographic positioning now and SEO location pages later. Mirrors theme_json.
begin;

alter table public.sites
  add column if not exists markets_json jsonb not null default '{}'::jsonb;

commit;
