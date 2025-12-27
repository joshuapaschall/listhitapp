alter table public.agents
  add column if not exists sip_username text,
  add column if not exists sip_password text;
