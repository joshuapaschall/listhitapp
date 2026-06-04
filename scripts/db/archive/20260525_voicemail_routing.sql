-- Voicemail + inbound routing foundation (SendText-style).
-- Additive only; safe to run on production.

-- 1) Voicemail + routing state on calls.
alter table public.calls
  add column if not exists voicemail boolean not null default false,
  add column if not exists voicemail_storage_path text,
  add column if not exists voicemail_duration_seconds integer,
  add column if not exists routing_mode text,
  add column if not exists forwarded_to text,
  add column if not exists forwarded_at timestamptz,
  add column if not exists browser_ring_timeout_at timestamptz;

-- 2) Per-number routing configuration on inbound_numbers.
--    call_routing_mode: 'browser_only' | 'browser_first_then_forward' | 'forwarding_only'
alter table public.inbound_numbers
  add column if not exists call_routing_mode text not null default 'browser_only',
  add column if not exists call_forwarding_number text,
  add column if not exists browser_ring_timeout_seconds integer not null default 20,
  add column if not exists voicemail_greeting_url text;

-- 3) Constrain routing mode to valid values (guarded so re-runs don't error).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbound_numbers_call_routing_mode_check'
  ) then
    alter table public.inbound_numbers
      add constraint inbound_numbers_call_routing_mode_check
      check (call_routing_mode in ('browser_only', 'browser_first_then_forward', 'forwarding_only'));
  end if;
end $$;

-- 4) Index for voicemail filtering on the calls list.
create index if not exists idx_calls_voicemail on public.calls (voicemail) where voicemail = true;
