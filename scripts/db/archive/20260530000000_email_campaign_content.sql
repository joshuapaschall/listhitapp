create table if not exists public.email_campaign_content (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  subject text,
  html text,
  updated_at timestamptz not null default now()
);
