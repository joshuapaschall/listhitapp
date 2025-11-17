-- Per-organization voice routing fallbacks
create table if not exists public.org_voice_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  fallback_mode text not null default 'dispatcher_sip'
    check (fallback_mode in ('dispatcher_sip','ring_all','voicemail','none')),
  fallback_sip_username text,
  voicemail_media_url text,
  queue_timeout_secs int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.moddatetime() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists org_voice_settings_touch on public.org_voice_settings;
create trigger org_voice_settings_touch
  before update on public.org_voice_settings
  for each row execute procedure public.moddatetime();
