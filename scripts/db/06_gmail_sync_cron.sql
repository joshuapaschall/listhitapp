alter table public.gmail_tokens add column if not exists sync_enabled boolean not null default true;
alter table public.gmail_tokens add column if not exists last_synced_at timestamptz;
alter table public.gmail_tokens add column if not exists last_sync_error text;
alter table public.gmail_tokens add column if not exists last_sync_error_at timestamptz;
create index if not exists gmail_tokens_sync_due_idx on public.gmail_tokens (sync_enabled, last_synced_at);
