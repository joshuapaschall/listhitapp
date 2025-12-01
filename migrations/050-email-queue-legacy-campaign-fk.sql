-- Align email campaign queue with legacy campaigns table
alter table public.email_campaign_queue
  drop constraint if exists email_campaign_queue_campaign_id_fkey;

-- Clear any orphaned references before adding the new constraint
update public.email_campaign_queue q
set campaign_id = null
where campaign_id is not null
  and not exists (
    select 1 from public.campaigns c where c.id = q.campaign_id
  );

alter table public.email_campaign_queue
  add constraint email_campaign_queue_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns(id);
