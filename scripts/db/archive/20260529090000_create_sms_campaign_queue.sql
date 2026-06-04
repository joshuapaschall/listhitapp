-- Durable SMS campaign queue
create table if not exists public.sms_campaign_queue (
  id bigint generated always as identity primary key,
  campaign_id uuid references public.campaigns(id),
  recipient_id uuid references public.campaign_recipients(id),
  buyer_id uuid references public.buyers(id),
  to_number text not null,
  payload jsonb not null,
  status text not null default 'pending',
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 8,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  locked_by text,
  last_error text,
  last_error_at timestamptz,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sms_campaign_queue_campaign_recipient_to_number_uniq_idx
  on public.sms_campaign_queue (campaign_id, recipient_id, to_number);
create index if not exists sms_campaign_queue_scheduled_idx on public.sms_campaign_queue (status, scheduled_for);
create index if not exists sms_campaign_queue_status_lock_expires_idx on public.sms_campaign_queue (status, lock_expires_at);

drop trigger if exists sms_campaign_queue_moddatetime on public.sms_campaign_queue;
create trigger sms_campaign_queue_moddatetime
before update on public.sms_campaign_queue
for each row execute procedure public.moddatetime();

create or replace function public.claim_sms_queue_jobs(
  p_limit int,
  p_worker text,
  p_lease_seconds int
) returns setof public.sms_campaign_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select id
    from public.sms_campaign_queue
    where status in ('pending')
      and scheduled_for <= now()
      and (lock_expires_at is null or lock_expires_at < now())
    order by scheduled_for asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  )
  update public.sms_campaign_queue q
  set status = 'processing',
      locked_at = now(),
      lock_expires_at = now() + make_interval(secs => coalesce(p_lease_seconds, 0)),
      locked_by = p_worker,
      last_error = null
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

grant execute on function public.claim_sms_queue_jobs(int, text, int) to service_role;

drop function if exists public.requeue_stuck_sms_jobs(integer, integer);
create or replace function public.requeue_stuck_sms_jobs(
  p_stuck_seconds int,
  p_limit int default 50
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count int;
begin
  with candidates as (
    select id
    from public.sms_campaign_queue
    where status = 'processing'
      and lock_expires_at is not null
      and lock_expires_at < now() - make_interval(secs => coalesce(p_stuck_seconds, 0))
    order by lock_expires_at asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  ), updated as (
    update public.sms_campaign_queue q
    set status = 'pending',
        locked_at = null,
        lock_expires_at = null,
        locked_by = null,
        scheduled_for = now(),
        attempts = q.attempts + 1,
        last_error = 'stuck lease expired',
        last_error_at = now()
    from candidates c
    where q.id = c.id
    returning 1
  )
  select count(*)::int into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.requeue_stuck_sms_jobs(int, int) to service_role;
