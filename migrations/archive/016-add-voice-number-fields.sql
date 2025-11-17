alter table voice_numbers
add column if not exists provider_id text,
add column if not exists status text,
add column if not exists friendly_name text,
add column if not exists created_at timestamp with time zone default now();
