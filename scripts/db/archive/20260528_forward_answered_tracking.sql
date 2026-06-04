-- Forward-leg answer tracking, symmetric with calls.browser_answered_at.
-- Lets call.hangup distinguish "forward target answered then hung up" (completed)
-- from "forward rang and timed out" (voicemail/missed).
alter table public.calls
  add column if not exists forward_answered_at timestamptz;
