-- Strengthen email campaign queue resilience and processing workflow
alter table public.email_campaign_queue
  add column if not exists recipient_id uuid,
  add column if not exists buyer_id uuid,
  add column if not exists to_email text,
  add column if not exists attempts int not null default 0,
  add column if not exists max_attempts int not null default 8,
  add column if not exists locked_at timestamptz,
  add column if not exists lock_expires_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists sent_at timestamptz;

create unique index if not exists email_campaign_queue_campaign_recipient_uniq_idx
  on public.email_campaign_queue (campaign_id, recipient_id)
  where recipient_id is not null;

create index if not exists email_campaign_queue_status_scheduled_idx
  on public.email_campaign_queue (status, scheduled_for);

create index if not exists email_campaign_queue_status_lock_expires_idx
  on public.email_campaign_queue (status, lock_expires_at);

create or replace function public.claim_email_queue_jobs(
  p_limit int,
  p_worker text,
  p_lease_seconds int
)
returns setof public.email_campaign_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select id
    from public.email_campaign_queue
    where status in ('pending')
      and scheduled_for <= now()
      and (lock_expires_at is null or lock_expires_at < now())
    order by scheduled_for asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update skip locked
  )
  update public.email_campaign_queue q
  set
    status = 'processing',
    locked_at = now(),
    lock_expires_at = now() + (coalesce(p_lease_seconds, 0) || ' seconds')::interval,
    locked_by = p_worker,
    last_error = null
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

create or replace function public.requeue_stuck_email_jobs(p_stuck_seconds int)
returns setof public.email_campaign_queue
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.email_campaign_queue q
  set
    status = 'pending',
    locked_at = null,
    lock_expires_at = null,
    locked_by = null,
    attempts = q.attempts + 1,
    last_error = 'stuck lease expired',
    last_error_at = now()
  where q.status = 'processing'
    and q.lock_expires_at is not null
    and q.lock_expires_at < now() - (coalesce(p_stuck_seconds, 0) || ' seconds')::interval
  returning q.*;
$$;

grant execute on function public.claim_email_queue_jobs(int, text, int) to service_role;
grant execute on function public.requeue_stuck_email_jobs(int) to service_role;
