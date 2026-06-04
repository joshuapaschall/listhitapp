-- A.5.1 — Native short link service tables, indexes, RPC

create extension if not exists pgcrypto;

create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  domain text not null,
  target_url text not null,

  -- Attribution (any can be null — a short link is standalone-capable)
  campaign_id uuid references public.campaigns(id) on delete cascade,
  campaign_recipient_id uuid references public.campaign_recipients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  created_by uuid references auth.users(id),

  -- Organization / lifecycle
  tags text[] not null default '{}',
  expires_at timestamptz,

  -- Aggregate click data (avoids a separate clicks table for our use case)
  click_count integer not null default 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Slug format guard: 4-12 chars, URL-safe
  constraint short_links_slug_format check (slug ~ '^[A-Za-z0-9_-]{4,12}$'),
  -- A slug must be unique within a domain (different domains can reuse the same slug)
  constraint short_links_unique_domain_slug unique (domain, slug)
);

-- The redirect-path lookup index. (domain, slug) is the WHERE clause every redirect hits.
create index if not exists short_links_domain_slug_lookup_idx
  on public.short_links (domain, slug);

create index if not exists short_links_campaign_id_idx
  on public.short_links (campaign_id);

create index if not exists short_links_campaign_recipient_id_idx
  on public.short_links (campaign_recipient_id);

create index if not exists short_links_property_id_idx
  on public.short_links (property_id);

create index if not exists short_links_tags_idx
  on public.short_links using gin (tags);

-- updated_at trigger
create or replace function public.short_links_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists short_links_updated_at_trigger on public.short_links;
create trigger short_links_updated_at_trigger
  before update on public.short_links
  for each row execute function public.short_links_set_updated_at();

-- RLS: service-role only (the redirect route uses service role). Block other access.
alter table public.short_links enable row level security;

drop policy if exists "short_links service role full access" on public.short_links;
create policy "short_links service role full access"
  on public.short_links
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- The click-recording RPC. Atomically:
--   1. Bump click_count, set first_clicked_at (if null) and last_clicked_at on the short_links row
--   2. Cascade clicked_at to campaign_recipients (first-write-wins) when the link is tied to a recipient
-- Returns void; callers don't need confirmation.
create or replace function public.record_short_link_click(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
begin
  update public.short_links
  set
    click_count = click_count + 1,
    last_clicked_at = now(),
    first_clicked_at = coalesce(first_clicked_at, now())
  where id = p_link_id
  returning campaign_recipient_id into v_recipient_id;

  -- Cascade to campaign_recipients.clicked_at (first-write-wins)
  if v_recipient_id is not null then
    update public.campaign_recipients
    set clicked_at = now()
    where id = v_recipient_id
      and clicked_at is null;
  end if;
end;
$$;

grant execute on function public.record_short_link_click(uuid) to service_role;
