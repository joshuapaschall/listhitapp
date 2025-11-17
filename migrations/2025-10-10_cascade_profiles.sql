-- 2025-10-10_cascade_profiles.sql

-- 1) profiles → auth.users (cascade)
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id)
  on delete cascade;

-- 2) (Optional but recommended) template for other tables that belong to a user:
-- alter table public.<table_name>
--   drop constraint if exists <constraint_name>;
-- alter table public.<table_name>
--   add constraint <constraint_name>
--   foreign key (<user_id_column>) references auth.users(id)
--   on delete cascade;
