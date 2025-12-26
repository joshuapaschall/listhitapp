-- Media links for short attachment URLs
create table if not exists public.media_links (
  id text primary key,
  storage_path text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);
