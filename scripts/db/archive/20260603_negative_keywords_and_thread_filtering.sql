-- Negative keywords (soft filtering layer) + inbox thread filtering.
--
-- IMPORTANT: This migration MUST be applied BEFORE the code deploys, because the
-- inbound SMS webhook and the inbox queries reference the new columns
-- (negative_keywords.match_type/action/is_system and
--  message_threads.filtered_at/filtered_keyword_id/filter_overridden).

-- Upgrade negative_keywords
alter table public.negative_keywords
  add column if not exists match_type text not null default 'phrase'
    check (match_type in ('exact','phrase')),
  add column if not exists action text not null default 'hide'
    check (action in ('hide','dnc')),
  add column if not exists is_system boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

drop index if exists negative_keywords_keyword_idx;
create unique index if not exists negative_keywords_org_keyword_match_unique
  on public.negative_keywords (org_id, lower(trim(keyword)), match_type);

create or replace function set_negative_keywords_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_negative_keywords_updated_at on public.negative_keywords;
create trigger trg_negative_keywords_updated_at before update on public.negative_keywords
  for each row execute function set_negative_keywords_updated_at();

-- Thread-level filtering for the inbox Filtered tab
alter table public.message_threads
  add column if not exists filtered_at timestamptz,
  add column if not exists filtered_keyword_id uuid
    references public.negative_keywords(id) on delete set null,
  add column if not exists filter_overridden boolean not null default false;
create index if not exists message_threads_filtered_at_idx
  on public.message_threads (filtered_at) where filtered_at is not null;

-- Display-only system carrier rows (locked in UI; the classifier owns enforcement)
insert into public.negative_keywords (keyword, match_type, action, is_system, org_id)
select w.keyword, 'exact', 'dnc', true, o.org_id
from (select distinct org_id from public.buyers where org_id is not null) o
cross join (values ('stop'),('stopall'),('unsubscribe'),('cancel'),('end'),('quit'),
                   ('optout'),('opt out'),('remove')) as w(keyword)
on conflict do nothing;
