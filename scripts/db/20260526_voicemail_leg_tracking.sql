alter table public.calls
  add column if not exists call_session_id text,
  add column if not exists browser_answered_at timestamptz;

create index if not exists idx_calls_call_session_id
  on public.calls (call_session_id);
