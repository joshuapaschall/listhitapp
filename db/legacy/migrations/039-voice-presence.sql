-- Voice presence tracking for agents and active call sessions
create table if not exists public.agents_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents(id) on delete cascade,
  sip_username text not null,
  status text not null check (status in ('online','offline')),
  last_seen timestamptz not null default now(),
  client_id text not null,
  unique (agent_id, client_id)
);

create index if not exists agents_sessions_online_idx
  on public.agents_sessions (status, last_seen desc);

create table if not exists public.calls_sessions (
  agent_session_id text primary key,
  customer_call_control_id text not null,
  status text not null check (status in ('dialing','ringing','bridged','ended')),
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

drop trigger if exists calls_sessions_set_updated_at on public.calls_sessions;
create trigger calls_sessions_set_updated_at
  before update on public.calls_sessions
  for each row execute procedure public.moddatetime();

alter table public.agents_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'agents_sessions'
      and policyname = 'service does all'
  ) then
    create policy "service does all" on public.agents_sessions for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1
    from pg_policies
    where tablename = 'agents_sessions'
      and policyname = 'agent can manage own presence'
  ) then
    create policy "agent can manage own presence" on public.agents_sessions
      for all to authenticated
      using (
        exists (
          select 1
          from public.agents a
          where a.auth_user_id = auth.uid()
            and a.id = agent_id
        )
      )
      with check (
        exists (
          select 1
          from public.agents a
          where a.auth_user_id = auth.uid()
            and a.id = agent_id
        )
      );
  end if;
end;
$$;
