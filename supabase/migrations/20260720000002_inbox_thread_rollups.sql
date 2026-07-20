-- Inbox performance: denormalized "last message" rollups on message_threads.
-- Moves all tab-membership + ordering into the DB so the inbox is correct and
-- snappy at any volume (no PostgREST 1,000-row cap, no client-side filtering).

-- 1. Rollup columns
alter table public.message_threads
  add column if not exists last_message_at        timestamptz,
  add column if not exists last_message_body       text,
  add column if not exists last_message_direction  text,
  add column if not exists last_message_is_bulk     boolean,
  add column if not exists has_inbound              boolean not null default false;

-- 2. Recompute one thread's rollups from its current (non-deleted) messages
create or replace function public.recompute_thread_rollup(p_thread_id uuid)
returns void
language plpgsql
as $$
declare
  v_last     record;
  v_inbound  boolean;
begin
  if p_thread_id is null then
    return;
  end if;

  select created_at, body, direction, is_bulk
    into v_last
  from public.messages
  where thread_id = p_thread_id
    and deleted_at is null
  order by created_at desc, id desc
  limit 1;

  select exists(
    select 1 from public.messages
    where thread_id = p_thread_id
      and deleted_at is null
      and direction = 'inbound'
  ) into v_inbound;

  update public.message_threads t
  set last_message_at        = v_last.created_at,   -- null when no messages remain
      last_message_body       = v_last.body,
      last_message_direction  = v_last.direction,
      last_message_is_bulk     = v_last.is_bulk,
      has_inbound              = coalesce(v_inbound, false)
  where t.id = p_thread_id;
end;
$$;

-- 3. AFTER trigger to keep rollups current on every message write
create or replace function public.trg_messages_rollup()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_thread_rollup(old.thread_id);
    return old;
  end if;

  perform public.recompute_thread_rollup(new.thread_id);

  if tg_op = 'UPDATE' and new.thread_id is distinct from old.thread_id then
    perform public.recompute_thread_rollup(old.thread_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_rollup on public.messages;
create trigger trg_messages_rollup
after insert or update or delete on public.messages
for each row execute function public.trg_messages_rollup();

-- 4. One-time set-based backfill for existing threads
with latest as (
  select distinct on (thread_id)
         thread_id, created_at, body, direction, is_bulk
  from public.messages
  where deleted_at is null
  order by thread_id, created_at desc, id desc
),
inb as (
  select distinct thread_id
  from public.messages
  where deleted_at is null and direction = 'inbound'
)
update public.message_threads t
set last_message_at        = l.created_at,
    last_message_body       = l.body,
    last_message_direction  = l.direction,
    last_message_is_bulk     = l.is_bulk,
    has_inbound              = (i.thread_id is not null)
from latest l
left join inb i on i.thread_id = l.thread_id
where t.id = l.thread_id;

-- 5. Indexes for snappy reads
create index if not exists messages_thread_id_created_at_idx
  on public.messages (thread_id, created_at desc)
  where deleted_at is null;

create index if not exists message_threads_last_message_at_idx
  on public.message_threads (last_message_at desc)
  where deleted_at is null;

create index if not exists message_threads_inbox_idx
  on public.message_threads (has_inbound, last_message_at desc)
  where deleted_at is null and filtered_at is null;

create index if not exists message_threads_sent_idx
  on public.message_threads (last_message_direction, last_message_is_bulk, last_message_at desc)
  where deleted_at is null and filtered_at is null;
