-- Segments: reusable, named buyer audience definitions (Mailchimp-style).
-- A segment stores a rule tree (definition jsonb) that the resolver engine
-- (lib/segments/resolver.ts) turns into a set of eligible buyer ids, for email
-- and/or SMS. Org-scoped and soft-deleted, mirroring the existing convention.

begin;

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  -- null channel = usable for both email and sms; 'email' or 'sms' restricts it
  channel text check (channel in ('email','sms')),
  -- top-level combinator, mirrored from definition.match for easy querying
  match text not null default 'all' check (match in ('all','any')),
  -- full rule tree: { "match": "all"|"any", "conditions": [...] }
  definition jsonb not null default '{"match":"all","conditions":[]}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists segments_org_id_idx on public.segments(org_id);
create index if not exists segments_org_active_idx on public.segments(org_id, deleted_at);

-- Org-scoped RLS, mirroring the pattern established in 20260603_org_rls.sql and
-- 20260605_deal_economics_and_tasks.sql: all actions gated on org_id = auth_org_id().
alter table public.segments enable row level security;

drop policy if exists segments_org_select on public.segments;
create policy segments_org_select on public.segments for select to authenticated using (org_id = auth_org_id());

drop policy if exists segments_org_insert on public.segments;
create policy segments_org_insert on public.segments for insert to authenticated with check (org_id = auth_org_id());

drop policy if exists segments_org_update on public.segments;
create policy segments_org_update on public.segments for update to authenticated using (org_id = auth_org_id()) with check (org_id = auth_org_id());

drop policy if exists segments_org_delete on public.segments;
create policy segments_org_delete on public.segments for delete to authenticated using (org_id = auth_org_id());

-- Allow a campaign to (a) reference a saved segment and (b) carry an inline
-- definition, plus store the last previewed count for UI display.
alter table public.campaigns
  add column if not exists segment_id uuid references public.segments(id) on delete set null,
  add column if not exists audience_definition jsonb,
  add column if not exists audience_preview_count integer;

create index if not exists campaigns_segment_id_idx on public.campaigns(segment_id);

commit;
