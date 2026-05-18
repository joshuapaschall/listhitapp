-- A.5 — Real SMS event data columns

-- Per-recipient actual cost (set on Telnyx message.finalized event)
alter table public.campaign_recipients
  add column if not exists actual_cost_usd numeric(10, 6);

-- Actual segments billed by Telnyx (can differ from our calculated estimate due to encoding edge cases)
alter table public.campaign_recipients
  add column if not exists actual_segments integer;

-- Recipient's actual carrier as resolved by Telnyx (stored for debugging deliverability issues; not surfaced in the UI in this PR)
alter table public.campaign_recipients
  add column if not exists recipient_carrier text;

-- First-reply timestamp — set when a buyer sends ANY inbound (not just STOP) to the campaign's from-number
alter table public.campaign_recipients
  add column if not exists replied_at timestamptz;

-- Index for the most-recent-campaign lookup used by the incoming SMS webhook
create index if not exists campaign_recipients_buyer_from_idx
  on public.campaign_recipients (buyer_id, from_number, sent_at desc nulls last);
