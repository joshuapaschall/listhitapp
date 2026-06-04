create table if not exists public.ses_reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  sending_state text not null,
  reason text,
  enforcement_status text,
  sending_enabled boolean,
  account_bounce_rate numeric,
  account_complaint_rate numeric,
  window_sent integer,
  raw jsonb
);

create index if not exists ses_reputation_snapshots_captured_idx
  on public.ses_reputation_snapshots (captured_at desc);

-- campaign status columns are text without CHECK constraints in the current
-- migration history (see 20260529110000_email_safety_circuit_breaker.sql), so
-- 'healthy', 'warn', 'frozen', and the existing paused safety statuses do not
-- require constraint rewrites.
