-- Multi-tenancy: switch buyer uniqueness from global to per-org.
--
-- buyers_email_norm_idx / buyers_phone_norm_idx enforced uniqueness across the
-- ENTIRE table (all orgs). With more than one org that is wrong: two businesses
-- must each be able to hold the same person. Replace them with per-org partial
-- unique indexes on (org_id, <norm>).
--
-- Safe to apply directly: global uniqueness is strictly stronger than per-org,
-- so every existing row already satisfies the new indexes (no dedupe needed).
-- buyers.org_id is NOT NULL with a default, so there are no NULL-org rows to
-- weaken the keys.

DROP INDEX IF EXISTS public.buyers_email_norm_idx;
DROP INDEX IF EXISTS public.buyers_phone_norm_idx;

CREATE UNIQUE INDEX IF NOT EXISTS buyers_org_email_norm_idx
  ON public.buyers (org_id, email_norm)
  WHERE email_norm IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS buyers_org_phone_norm_idx
  ON public.buyers (org_id, phone_norm)
  WHERE phone_norm IS NOT NULL;
