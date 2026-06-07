begin;

drop index if exists buyer_consents_org_id_idx;
alter table public.buyer_consents
  drop column if exists org_id;

commit;
