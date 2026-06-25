BEGIN;

alter table public.properties drop column if exists comps;

COMMIT;
