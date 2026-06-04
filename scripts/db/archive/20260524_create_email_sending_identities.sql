create table public.email_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null unique,
  ses_region text not null,
  dkim_tokens jsonb not null default '[]'::jsonb,
  dkim_status text not null default 'pending',
  verified_for_sending boolean not null default false,
  mail_from_domain text,
  mail_from_status text default 'pending',
  status text not null default 'pending',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_senders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid not null references public.email_domains(id) on delete cascade,
  from_email text not null,
  from_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, from_email)
);

create index email_domains_org_id_idx on public.email_domains(org_id);
create index email_senders_org_id_idx on public.email_senders(org_id);
create index email_senders_domain_id_idx on public.email_senders(domain_id);
create unique index email_senders_one_default_per_org_idx on public.email_senders(org_id) where is_default = true;

alter table public.email_domains enable row level security;
alter table public.email_senders enable row level security;

create policy "email_domains service can do all" on public.email_domains
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "email_senders service can do all" on public.email_senders
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
