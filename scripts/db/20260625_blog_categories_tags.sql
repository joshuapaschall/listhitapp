BEGIN;

alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists tags text[] not null default '{}'::text[];

-- Indexes to support future category/tag archive filtering (cheap to add now).
create index if not exists posts_site_category_idx on public.posts (site_id, category);
create index if not exists posts_tags_gin_idx on public.posts using gin (tags);

COMMIT;
