BEGIN;

drop index if exists public.posts_tags_gin_idx;
drop index if exists public.posts_site_category_idx;
alter table public.posts drop column if exists tags;
alter table public.posts drop column if exists category;

COMMIT;
