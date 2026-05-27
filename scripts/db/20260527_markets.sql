-- Markets: additive schema + conservative backfill for inbound number grouping.

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  purpose text not null,
  call_routing_mode text not null default 'browser_only',
  call_forwarding_number text,
  browser_ring_timeout_seconds integer not null default 20,
  voicemail_greeting_url text,
  voicemail_greeting_source text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'markets_purpose_check'
  ) then
    alter table public.markets
      add constraint markets_purpose_check
      check (purpose in ('campaign', 'main'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'markets_call_routing_mode_check'
  ) then
    alter table public.markets
      add constraint markets_call_routing_mode_check
      check (call_routing_mode in ('browser_only', 'browser_first_then_forward', 'forwarding_only'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'markets_voicemail_greeting_source_check'
  ) then
    alter table public.markets
      add constraint markets_voicemail_greeting_source_check
      check (
        voicemail_greeting_source is null
        or voicemail_greeting_source in ('polly', 'recorded')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'markets_org_id_name_key'
  ) then
    alter table public.markets
      add constraint markets_org_id_name_key unique (org_id, name);
  end if;
end
$$;

alter table public.inbound_numbers
  add column if not exists market_id uuid,
  add column if not exists config_override boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbound_numbers_market_id_fkey'
  ) then
    alter table public.inbound_numbers
      add constraint inbound_numbers_market_id_fkey
      foreign key (market_id) references public.markets(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_inbound_numbers_market_id on public.inbound_numbers(market_id);
create index if not exists idx_markets_org_id on public.markets(org_id);

insert into public.markets (org_id, name, purpose)
select orgs.org_id, 'Atlanta', 'campaign'
from (select distinct org_id from public.inbound_numbers) as orgs
where not exists (
  select 1
  from public.markets m
  where m.org_id = orgs.org_id and m.name = 'Atlanta'
);

insert into public.markets (org_id, name, purpose)
select orgs.org_id, 'Main Lines', 'main'
from (select distinct org_id from public.inbound_numbers) as orgs
where not exists (
  select 1
  from public.markets m
  where m.org_id = orgs.org_id and m.name = 'Main Lines'
);

insert into public.markets (org_id, name, purpose)
select orgs.org_id, 'Default', 'campaign'
from (select distinct org_id from public.inbound_numbers) as orgs
where not exists (
  select 1
  from public.markets m
  where m.org_id = orgs.org_id and m.name = 'Default'
);

update public.inbound_numbers n
set market_id = m.id
from public.markets m
where n.market_id is null
  and n.org_id = m.org_id
  and m.name = 'Atlanta'
  and (
    n.label ilike 'ATL %'
    or n.label ~ '^ATL[ 0-9]*$'
  );

update public.inbound_numbers n
set market_id = m.id
from public.markets m
where n.market_id is null
  and n.org_id = m.org_id
  and m.name = 'Main Lines'
  and n.label in ('Main', 'Sales', 'Backup');

update public.inbound_numbers n
set market_id = m.id
from public.markets m
where n.market_id is null
  and n.org_id = m.org_id
  and m.name = 'Default';

update public.inbound_numbers n
set config_override = true
from public.markets m
where n.market_id = m.id
  and (
    n.voicemail_greeting_url is not null
    or n.call_forwarding_number is not null
    or n.call_routing_mode <> 'browser_only'
    or n.browser_ring_timeout_seconds <> 20
    or m.purpose = 'main'
  );
