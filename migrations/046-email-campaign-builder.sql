-- Email template + campaign definition tables for richer email builder
create or replace function public.moddatetime() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.email_builder_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  content text not null,
  content_format text not null default 'markdown',
  blocks jsonb,
  preview_text text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_builder_templates_touch on public.email_builder_templates;
create trigger email_builder_templates_touch
  before update on public.email_builder_templates
  for each row execute procedure public.moddatetime();

create table if not exists public.email_campaign_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.email_builder_templates(id),
  subject text not null,
  content text not null,
  content_format text not null default 'markdown',
  blocks jsonb,
  target_groups text[],
  target_segments jsonb,
  sendfox_lists integer[],
  scheduled_for timestamptz,
  status text not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_campaign_definitions_touch on public.email_campaign_definitions;
create trigger email_campaign_definitions_touch
  before update on public.email_campaign_definitions
  for each row execute procedure public.moddatetime();

create table if not exists public.email_campaign_queue (
  id bigint generated always as identity primary key,
  campaign_id uuid references public.email_campaign_definitions(id),
  payload jsonb not null,
  created_by uuid references auth.users(id),
  contact_count integer not null default 0,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending',
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaign_queue_scheduled_idx
  on public.email_campaign_queue (status, scheduled_for);

drop trigger if exists email_campaign_queue_touch on public.email_campaign_queue;
create trigger email_campaign_queue_touch
  before update on public.email_campaign_queue
  for each row execute procedure public.moddatetime();

alter table public.email_builder_templates enable row level security;
alter table public.email_campaign_definitions enable row level security;
alter table public.email_campaign_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'email_builder_templates' and policyname = 'Service role manages email_builder_templates'
  ) then
    create policy "Service role manages email_builder_templates" on public.email_builder_templates
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'email_campaign_definitions' and policyname = 'Service role manages email_campaign_definitions'
  ) then
    create policy "Service role manages email_campaign_definitions" on public.email_campaign_definitions
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'email_campaign_queue' and policyname = 'Service role manages email_campaign_queue'
  ) then
    create policy "Service role manages email_campaign_queue" on public.email_campaign_queue
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'email_builder_templates' and policyname = 'Users manage their email_builder_templates'
  ) then
    create policy "Users manage their email_builder_templates" on public.email_builder_templates
      for all
      using (auth.uid() = created_by)
      with check (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'email_campaign_definitions' and policyname = 'Users manage their email_campaign_definitions'
  ) then
    create policy "Users manage their email_campaign_definitions" on public.email_campaign_definitions
      for all
      using (auth.uid() = created_by)
      with check (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'email_campaign_queue' and policyname = 'Users manage their email_campaign_queue'
  ) then
    create policy "Users manage their email_campaign_queue" on public.email_campaign_queue
      for all
      using (auth.uid() = created_by or auth.role() = 'service_role')
      with check (auth.uid() = created_by or auth.role() = 'service_role');
  end if;
end;
$$;
