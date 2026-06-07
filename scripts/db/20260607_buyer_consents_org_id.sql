-- Add org_id to buyer_consents for tenant scoping + audit of website lead consent.
-- buyer_consents already has service_role full access; this column is set by the
-- public signup route (service role) from the resolved site's org.
begin;

alter table public.buyer_consents
  add column if not exists org_id uuid;

create index if not exists buyer_consents_org_id_idx on public.buyer_consents (org_id);

commit;
