-- User invite + first-sign-in password change.
--
-- must_change_password: set when an admin creates a user with a password they
-- chose. PasswordChangeGuard redirects the user to /set-password until it clears.
-- invited_at: stamped when a user is created via the emailed invite link, so the
-- users table can distinguish "invited, never signed in" from "active".
--
-- Applied manually in the Supabase SQL editor; this file keeps the tree in sync.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles
  add column if not exists invited_at timestamptz;
