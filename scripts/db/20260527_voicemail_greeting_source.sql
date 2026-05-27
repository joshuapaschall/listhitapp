alter table public.inbound_numbers
  add column if not exists voicemail_greeting_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbound_numbers_voicemail_greeting_source_check'
  ) then
    alter table public.inbound_numbers
      add constraint inbound_numbers_voicemail_greeting_source_check
      check (voicemail_greeting_source is null or voicemail_greeting_source in ('polly', 'recorded'));
  end if;
end $$;
