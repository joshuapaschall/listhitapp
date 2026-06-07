-- 20260607_site_builder.sql
-- Website builder foundation: sites, pages, domains.
-- Convention: idempotent, BEGIN/COMMIT, RLS enabled with authenticated policies.
-- Org scoping is enforced in the app layer (requireOrgContext + supabaseAdmin),
-- matching the existing buyers/campaigns pattern. The PUBLIC site renderer reads
-- published rows via supabaseAdmin (service role) and bypasses RLS by design.

begin;

create table if not exists public.sites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  name         text not null,
  slug         text not null,
  persona      text not null default 'cash',
  template_id  text not null default 'aspen',
  theme_json   jsonb not null default '{}'::jsonb,
  status       text not null default 'draft',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists sites_slug_key on public.sites (lower(slug));
create index if not exists sites_org_id_idx on public.sites (org_id);

create table if not exists public.site_pages (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites(id) on delete cascade,
  org_id           uuid not null,
  path             text not null default '/',
  title            text,
  meta_description text,
  puck_data        jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists site_pages_site_path_key on public.site_pages (site_id, path);
create index if not exists site_pages_org_id_idx on public.site_pages (org_id);

create table if not exists public.site_domains (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  org_id          uuid not null,
  domain          text not null,
  type            text not null default 'custom',
  vercel_domain_id text,
  verification    jsonb,
  status          text not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists site_domains_domain_key on public.site_domains (lower(domain));
create index if not exists site_domains_site_id_idx on public.site_domains (site_id);
create index if not exists site_domains_org_id_idx on public.site_domains (org_id);

create or replace function public.set_site_builder_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at
  before update on public.sites
  for each row execute function public.set_site_builder_updated_at();

drop trigger if exists trg_site_pages_updated_at on public.site_pages;
create trigger trg_site_pages_updated_at
  before update on public.site_pages
  for each row execute function public.set_site_builder_updated_at();

drop trigger if exists trg_site_domains_updated_at on public.site_domains;
create trigger trg_site_domains_updated_at
  before update on public.site_domains
  for each row execute function public.set_site_builder_updated_at();

alter table public.sites        enable row level security;
alter table public.site_pages   enable row level security;
alter table public.site_domains enable row level security;

drop policy if exists "sites_select_authenticated" on public.sites;
create policy "sites_select_authenticated" on public.sites for select to authenticated using (true);
drop policy if exists "sites_insert_authenticated" on public.sites;
create policy "sites_insert_authenticated" on public.sites for insert to authenticated with check (true);
drop policy if exists "sites_update_authenticated" on public.sites;
create policy "sites_update_authenticated" on public.sites for update to authenticated using (true) with check (true);
drop policy if exists "sites_delete_authenticated" on public.sites;
create policy "sites_delete_authenticated" on public.sites for delete to authenticated using (true);

drop policy if exists "site_pages_select_authenticated" on public.site_pages;
create policy "site_pages_select_authenticated" on public.site_pages for select to authenticated using (true);
drop policy if exists "site_pages_insert_authenticated" on public.site_pages;
create policy "site_pages_insert_authenticated" on public.site_pages for insert to authenticated with check (true);
drop policy if exists "site_pages_update_authenticated" on public.site_pages;
create policy "site_pages_update_authenticated" on public.site_pages for update to authenticated using (true) with check (true);
drop policy if exists "site_pages_delete_authenticated" on public.site_pages;
create policy "site_pages_delete_authenticated" on public.site_pages for delete to authenticated using (true);

drop policy if exists "site_domains_select_authenticated" on public.site_domains;
create policy "site_domains_select_authenticated" on public.site_domains for select to authenticated using (true);
drop policy if exists "site_domains_insert_authenticated" on public.site_domains;
create policy "site_domains_insert_authenticated" on public.site_domains for insert to authenticated with check (true);
drop policy if exists "site_domains_update_authenticated" on public.site_domains;
create policy "site_domains_update_authenticated" on public.site_domains for update to authenticated using (true) with check (true);
drop policy if exists "site_domains_delete_authenticated" on public.site_domains;
create policy "site_domains_delete_authenticated" on public.site_domains for delete to authenticated using (true);

commit;
