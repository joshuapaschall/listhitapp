begin;

alter table public.sites
  drop column if exists markets_json;

commit;
