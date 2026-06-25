BEGIN;

alter table public.properties
  add column if not exists comps jsonb not null default '[]'::jsonb;

COMMIT;
