-- Rollback: drop the plain unique index on site_domains(domain).
BEGIN;
DROP INDEX IF EXISTS public.site_domains_domain_unique;
COMMIT;
