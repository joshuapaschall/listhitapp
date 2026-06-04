-- Org-scope anonymous inbox threads (buyer_id IS NULL).
--
-- Anonymous threads previously keyed only on phone_number, so two orgs texting the
-- same unknown number could collide. This backfills org_id from the inbound DID the
-- thread replies from, then adds a partial unique index. The index CANNOT be a
-- Supabase onConflict target, so the app uses org-scoped select-then-insert.
--
-- Apply manually before deploying the code that writes org_id on anon threads.

-- 1) Backfill org_id on anonymous threads from inbound_numbers (matched on the DID).
update public.message_threads t
set org_id = n.org_id
from public.inbound_numbers n
where t.buyer_id is null
  and t.org_id is null
  and n.enabled = true
  and n.e164 = t.preferred_from_number;

-- 2) Org-scope anonymous threads with a partial unique index.
create unique index if not exists uniq_anon_thread_org_phone
  on public.message_threads (org_id, phone_number)
  where buyer_id is null;
