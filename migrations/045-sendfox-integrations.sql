-- Store per-user SendFox OAuth credentials
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create or replace function public.moddatetime() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_integrations_touch on public.user_integrations;
create trigger user_integrations_touch
  before update on public.user_integrations
  for each row execute procedure public.moddatetime();

alter table public.user_integrations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'user_integrations'
      and policyname = 'Service role can manage user_integrations'
  ) then
    create policy "Service role can manage user_integrations" on public.user_integrations
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1
    from pg_policies
    where tablename = 'user_integrations'
      and policyname = 'Users manage their user_integrations'
  ) then
    create policy "Users manage their user_integrations" on public.user_integrations
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;
