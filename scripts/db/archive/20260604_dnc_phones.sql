-- Phone-level Do-Not-Contact blocklist.
--
-- IMPORTANT: Apply this migration BEFORE the code deploys. The inbound SMS
-- webhook and the buyers-import route write to this table via supabaseAdmin with
-- explicit org_id filtering; the DNC API reads/writes it through the org-scoped
-- client (RLS enforced by the policy below).

create table if not exists public.dnc_phones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  normalized_phone text not null,
  phone_display text,
  reason text,
  source text not null default 'manual' check (source in ('manual','keyword','stop','imported')),
  created_at timestamptz not null default now(),
  unique (org_id, normalized_phone)
);
create index if not exists dnc_phones_org_idx on public.dnc_phones (org_id);
alter table public.dnc_phones enable row level security;
drop policy if exists dnc_phones_org_rw on public.dnc_phones;
create policy dnc_phones_org_rw on public.dnc_phones
  for all using (org_id = auth_org_id()) with check (org_id = auth_org_id());
