-- Rollback: remove the blog posts table, its policies and indexes.
BEGIN;
drop policy if exists posts_select_own on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
drop index if exists public.posts_site_slug_uniq;
drop index if exists public.posts_site_status_idx;
drop index if exists public.posts_org_idx;
drop table if exists public.posts cascade;
COMMIT;
