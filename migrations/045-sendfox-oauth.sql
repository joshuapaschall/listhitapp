-- Per-user SendFox OAuth tokens
create table if not exists public.sendfox_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_type text default 'bearer',
  scope text,
  expires_at timestamptz,
  revoked_at timestamptz,
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

drop trigger if exists sendfox_tokens_set_updated_at on public.sendfox_tokens;
create trigger sendfox_tokens_set_updated_at
  before update on public.sendfox_tokens
  for each row execute procedure public.moddatetime();

alter table public.sendfox_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sendfox_tokens' and policyname = 'service access'
  ) then
    create policy "service access" on public.sendfox_tokens for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sendfox_tokens' and policyname = 'owner can manage token'
  ) then
    create policy "owner can manage token" on public.sendfox_tokens for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create index if not exists sendfox_tokens_revoked_idx on public.sendfox_tokens (revoked_at);
