-- Phase 1 email deliverability safety: hard-bounce tracking and pauseable queue rows.
alter table public.campaign_recipients
  add column if not exists bounce_type text;

-- campaign_recipients.status, email_campaign_queue.status, and campaigns.status are text columns
-- without CHECK constraints in the current migration history, so no constraint rewrite is needed
-- for recipient status='paused', queue status='paused', or campaigns.status='paused_by_safety'.
