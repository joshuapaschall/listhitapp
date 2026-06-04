drop index if exists public.campaigns_org_channel_sent_at_idx;

alter table public.campaigns drop column if exists sent_at;
