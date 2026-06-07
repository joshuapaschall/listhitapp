-- Business info (contact details, socials, opt-in config) for site builder.
-- Powers the auto-generated Contact page + combined Terms/Privacy doc and the
-- SMS opt-in disclosure. Mirrors the existing theme_json jsonb pattern on sites.
begin;

alter table public.sites
  add column if not exists business_json jsonb not null default '{}'::jsonb;

commit;
