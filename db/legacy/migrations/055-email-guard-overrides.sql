-- Admin "unfreeze" override for the email reputation guard.
-- The latest row with override_until > now() is the active override; it lets
-- sending resume while the reputation snapshot reads `frozen`, for a bounded
-- window. Account-wide (matches the account-wide reputation model). Server
-- access is via supabaseAdmin (service role bypasses RLS); no client policy.
create table if not exists public.email_guard_overrides (
  id uuid primary key default gen_random_uuid(),
  override_until timestamptz not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists email_guard_overrides_until_idx
  on public.email_guard_overrides (override_until desc);

alter table public.email_guard_overrides enable row level security;
