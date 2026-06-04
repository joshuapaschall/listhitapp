/*
  Backfill view permissions added by the property/offer/showing permission split.

  The original 20260531_seed_permission_defaults.sql may already have been run in
  production, so this additive migration grants only the new read keys to existing
  non-admin profiles that appear to have the Phase 1 agent baseline already.
*/

insert into public.permissions (id, user_id, permission_key, granted)
select
  gen_random_uuid(),
  profiles.id,
  view_keys.permission_key,
  true
from public.profiles
cross join unnest(array[
  'properties.view',
  'offers.view',
  'showings.view'
]::text[]) as view_keys(permission_key)
where coalesce(profiles.role, '') <> 'admin'
  and exists (
    select 1
    from public.permissions existing_permissions
    where existing_permissions.user_id = profiles.id
      and existing_permissions.permission_key = 'buyers.view'
      and existing_permissions.granted = true
  )
  and exists (
    select 1
    from public.permissions existing_permissions
    where existing_permissions.user_id = profiles.id
      and existing_permissions.permission_key = 'offers.manage'
      and existing_permissions.granted = true
  )
  and exists (
    select 1
    from public.permissions existing_permissions
    where existing_permissions.user_id = profiles.id
      and existing_permissions.permission_key = 'showings.manage'
      and existing_permissions.granted = true
  )
on conflict (user_id, permission_key) do nothing;
