/*
  Permission engine defaults for ListHit Phase 1.

  Semantics:
  - Deny by default: if no permissions row exists for (user_id, permission_key),
    the permission check denies access.
  - Admin bypass: profiles.role = 'admin' passes every permission check without
    requiring rows in permissions, so admins cannot be locked out by missing or
    false permission rows.
  - permissions.granted = true grants a key; granted = false or no row denies.
*/

create unique index if not exists permissions_user_id_permission_key_idx
  on public.permissions (user_id, permission_key);

insert into public.permissions (id, user_id, permission_key, granted)
select
  gen_random_uuid(),
  profiles.id,
  baseline.permission_key,
  true
from public.profiles
cross join unnest(array[
  'buyers.view',
  'buyers.edit',
  'inbox.view',
  'inbox.send',
  'calls.make_receive',
  'showings.manage',
  'offers.manage',
  'campaigns.view'
]::text[]) as baseline(permission_key)
where coalesce(profiles.role, '') <> 'admin'
on conflict (user_id, permission_key) do nothing;
