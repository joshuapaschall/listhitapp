-- Add user-level Telnyx WebRTC credentials and call attribution.

alter table if exists public.profiles
  add column if not exists telnyx_credential_id text;

alter table if exists public.profiles
  add column if not exists sip_username text;

alter table if exists public.profiles
  add column if not exists sip_password text;

create unique index if not exists profiles_sip_username_unique_idx
  on public.profiles (sip_username)
  where sip_username is not null;

alter table if exists public.calls
  add column if not exists user_id uuid references public.profiles(id);

create index if not exists calls_user_id_idx
  on public.calls (user_id);
