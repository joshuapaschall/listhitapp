-- Refactor gmail_tokens to support multiple Gmail accounts per user.
-- The current PK is user_id (= one account per user). Change to id PK, with
-- a partial unique index ensuring exactly one active account per user.

-- 1. Add an id column (new PK)
alter table public.gmail_tokens add column if not exists id uuid not null default gen_random_uuid();

-- 2. Drop the existing user_id PK constraint (if present)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'gmail_tokens_pkey'
      and conrelid = 'public.gmail_tokens'::regclass
  ) then
    alter table public.gmail_tokens drop constraint gmail_tokens_pkey;
  end if;
end$$;

-- 3. Promote id to PK
alter table public.gmail_tokens add primary key (id);

-- 4. Keep user_id NOT NULL (it stays as FK to auth.users via the column ref)
alter table public.gmail_tokens alter column user_id set not null;

-- 5. Add is_active flag
alter table public.gmail_tokens add column if not exists is_active boolean not null default false;

-- 6. (user_id, email) must be unique — a user can't connect the same Gmail twice
create unique index if not exists gmail_tokens_user_email_uniq
  on public.gmail_tokens (user_id, email);

-- 7. At most ONE active account per user (partial unique index)
create unique index if not exists gmail_tokens_one_active_per_user_uniq
  on public.gmail_tokens (user_id)
  where is_active = true;

-- 8. For any existing rows, mark the first per user as active
-- (Safe even on an empty table.)
update public.gmail_tokens t
set is_active = true
where t.id = (
  select id from public.gmail_tokens
  where user_id = t.user_id
  order by updated_at desc nulls last
  limit 1
)
and not exists (
  select 1 from public.gmail_tokens
  where user_id = t.user_id and is_active = true
);
