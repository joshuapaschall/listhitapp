-- Fix publish/custom-domain upserts. SiteService.publish and the domain-add flow
-- upsert site_domains with onConflict "domain", but the table only had a unique
-- index on the expression lower(domain) (site_domains_domain_key), which a bare
-- ON CONFLICT (domain) target can't match. Add a plain unique index on the
-- domain column. The app stores domain lowercased and the lower(domain) index
-- already blocks case-variant dupes, so this won't conflict with existing rows.
-- Idempotent — safe to re-run.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS site_domains_domain_unique
  ON public.site_domains (domain);
COMMIT;
