-- Blog posts for tenant sites. Public reads happen via supabaseAdmin
-- (sessionless), so these RLS policies are for the authenticated dashboard
-- (next PR). Every row is scoped to both org_id and site_id. Idempotent.
BEGIN;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  slug text not null,
  title text not null,
  excerpt text,
  body_html text,
  featured_image_url text,
  featured_image_alt text,
  focus_keyword text,
  meta_title text,
  meta_description text,
  og_image_url text,
  author_name text,
  seo_score integer,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists posts_site_slug_uniq
  on public.posts (site_id, slug) where deleted_at is null;
create index if not exists posts_site_status_idx on public.posts (site_id, status);
create index if not exists posts_org_idx on public.posts (org_id);

alter table public.posts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_select_own') then
    create policy posts_select_own on public.posts
      for select to authenticated using (org_id = public.auth_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_insert_own') then
    create policy posts_insert_own on public.posts
      for insert to authenticated with check (org_id = public.auth_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_update_own') then
    create policy posts_update_own on public.posts
      for update to authenticated using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_delete_own') then
    create policy posts_delete_own on public.posts
      for delete to authenticated using (org_id = public.auth_org_id());
  end if;
end $$;

COMMIT;
