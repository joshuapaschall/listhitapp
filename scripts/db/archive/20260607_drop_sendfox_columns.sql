BEGIN;

ALTER TABLE public.buyers
  DROP COLUMN IF EXISTS sendfox_hidden,
  DROP COLUMN IF EXISTS sendfox_contact_id,
  DROP COLUMN IF EXISTS sendfox_suppressed,
  DROP COLUMN IF EXISTS sendfox_bounced_at,
  DROP COLUMN IF EXISTS sendfox_complained_at,
  DROP COLUMN IF EXISTS sendfox_double_opt_in,
  DROP COLUMN IF EXISTS sendfox_double_opt_in_at;

ALTER TABLE public.groups
  DROP COLUMN IF EXISTS sendfox_list_id;

DROP TABLE IF EXISTS public.sendfox_list_sync_logs;
DROP TABLE IF EXISTS public.sendfox_list_mismatches;

COMMIT;
