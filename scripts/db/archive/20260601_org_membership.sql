-- Establish organization membership fields and backfill the current single-tenant org.

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles(org_id);

DO $$
DECLARE
  constraint_record record;
begin
  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;

  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user','admin','owner'));
END $$;

DO $$
DECLARE
  canonical_org_id uuid;
  owner_profile_id uuid;
begin
  SELECT org_id INTO canonical_org_id
  FROM public.inbound_numbers
  WHERE org_id IS NOT NULL
  LIMIT 1;

  IF canonical_org_id IS NULL THEN
    SELECT id INTO canonical_org_id
    FROM public.organizations
    LIMIT 1;
  END IF;

  IF canonical_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO canonical_org_id;
  END IF;

  UPDATE public.profiles
  SET org_id = canonical_org_id
  WHERE org_id IS NULL;

  SELECT id INTO owner_profile_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF owner_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'owner'
    WHERE id = owner_profile_id;

    UPDATE public.organizations
    SET owner_id = owner_profile_id
    WHERE id = canonical_org_id
      AND owner_id IS NULL;
  END IF;
END $$;

COMMIT;
