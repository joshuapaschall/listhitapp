BEGIN;

ALTER TABLE public.buyers
  ADD COLUMN IF NOT EXISTS sendfox_hidden boolean,
  ADD COLUMN IF NOT EXISTS sendfox_contact_id integer,
  ADD COLUMN IF NOT EXISTS sendfox_suppressed boolean,
  ADD COLUMN IF NOT EXISTS sendfox_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sendfox_complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS sendfox_double_opt_in boolean,
  ADD COLUMN IF NOT EXISTS sendfox_double_opt_in_at timestamptz;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS sendfox_list_id integer;

-- This rollback restores only the dropped SendFox columns as nullable and empty.
-- It does not recreate public.sendfox_list_sync_logs or public.sendfox_list_mismatches.

COMMIT;
