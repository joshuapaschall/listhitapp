alter table public.agents
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists sip_username text,
  add column if not exists telnyx_credential_id text,
  add column if not exists sip_password text;

create index if not exists agents_auth_user_idx on public.agents(auth_user_id);

-- RLS helpers
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agents' and policyname='service role can do everything on agents'
  ) then
    create policy "service role can do everything on agents"
      on public.agents
      for all
      to public
      using (auth.role() = 'service_role'::text)
      with check (auth.role() = 'service_role'::text);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agents' and policyname='agent can select own row'
  ) then
    create policy "agent can select own row"
      on public.agents
      for select
      to authenticated
      using (auth.uid() = auth_user_id);
  end if;
end$$;
