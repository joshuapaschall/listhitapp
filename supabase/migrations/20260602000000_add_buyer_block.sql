-- Bidirectional buyer block: stops outbound AND inbound SMS/calls without
-- clobbering the sales-pipeline `status`. The webhooks select blocked_at, so
-- this migration MUST be applied BEFORE the code is deployed.
alter table public.buyers
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists email_suppressed_at timestamptz,
  add column if not exists email_suppressed_reason text;

create index if not exists buyers_blocked_at_idx
  on public.buyers (blocked_at) where blocked_at is not null;
