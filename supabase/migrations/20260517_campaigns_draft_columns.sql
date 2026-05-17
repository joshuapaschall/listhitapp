-- Allow drafts to exist without a message body
alter table public.campaigns alter column message drop not null;

-- Track when the row was last modified (autosave)
alter table public.campaigns add column if not exists updated_at timestamptz not null default now();

-- Per-campaign sender identity
alter table public.campaigns add column if not exists from_name text;
alter table public.campaigns add column if not exists from_email text;

-- Auto-update updated_at on row update
create or replace function public.set_campaigns_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_campaigns_updated_at();
