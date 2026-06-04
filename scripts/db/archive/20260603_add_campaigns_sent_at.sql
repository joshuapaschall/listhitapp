alter table public.campaigns add column if not exists sent_at timestamptz;

create index if not exists campaigns_org_channel_sent_at_idx
  on public.campaigns (org_id, channel, sent_at desc) where sent_at is not null;

-- Backfill historical sends from recipients' real send times so existing sends
-- immediately participate in "last campaign" segment scopes.
update public.campaigns c
set sent_at = sub.max_sent
from (
  select campaign_id, max(sent_at) as max_sent
  from public.campaign_recipients
  where sent_at is not null
  group by campaign_id
) sub
where c.id = sub.campaign_id
  and c.sent_at is null;
