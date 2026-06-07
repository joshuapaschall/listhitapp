-- ROLLBACK_20260607_site_builder.sql
-- Reverses 20260607_site_builder.sql

begin;

drop trigger if exists trg_site_domains_updated_at on public.site_domains;
drop trigger if exists trg_site_pages_updated_at on public.site_pages;
drop trigger if exists trg_sites_updated_at on public.sites;

drop table if exists public.site_domains cascade;
drop table if exists public.site_pages cascade;
drop table if exists public.sites cascade;

drop function if exists public.set_site_builder_updated_at();

commit;
