-- Roll back organization membership fields while preserving organization and profile rows.

BEGIN;

UPDATE public.profiles
SET role = 'admin'
WHERE role = 'owner';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user','admin'));

DROP INDEX IF EXISTS public.profiles_org_id_idx;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS org_id,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS business_name,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS onboarding_completed,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;
