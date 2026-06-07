begin;

alter table public.sites
  drop column if exists business_json;

commit;
