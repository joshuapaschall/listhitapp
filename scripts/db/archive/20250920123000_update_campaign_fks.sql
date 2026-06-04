alter table public.email_events
  drop constraint if exists email_events_campaign_id_fkey,
  drop constraint if exists email_events_recipient_id_fkey;

alter table public.email_campaign_queue
  drop constraint if exists email_campaign_queue_campaign_id_fkey,
  drop constraint if exists email_campaign_queue_recipient_id_fkey;

alter table public.email_events
  add constraint email_events_campaign_id_fkey
    foreign key (campaign_id) references public.campaigns(id) on delete set null,
  add constraint email_events_recipient_id_fkey
    foreign key (recipient_id) references public.campaign_recipients(id) on delete set null;

alter table public.email_campaign_queue
  add constraint email_campaign_queue_campaign_id_fkey
    foreign key (campaign_id) references public.campaigns(id) on delete cascade,
  add constraint email_campaign_queue_recipient_id_fkey
    foreign key (recipient_id) references public.campaign_recipients(id) on delete cascade;
