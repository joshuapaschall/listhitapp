-- Database bootstrap: helpers for idempotent updates

alter table public.buyers add column if not exists is_unsubscribed boolean not null default false;
alter table public.buyers add column if not exists unsubscribed_at timestamptz;
