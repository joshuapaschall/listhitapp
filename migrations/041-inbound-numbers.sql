-- Map inbound DIDs to organizations for voice routing
create table if not exists public.inbound_numbers (
  e164 text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  telnyx_number_id text,
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.moddatetime() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inbound_numbers_touch on public.inbound_numbers;
create trigger inbound_numbers_touch
  before update on public.inbound_numbers
  for each row execute procedure public.moddatetime();

alter table public.inbound_numbers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'inbound_numbers'
      and policyname = 'service can do all'
  ) then
    create policy "service can do all" on public.inbound_numbers
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;
