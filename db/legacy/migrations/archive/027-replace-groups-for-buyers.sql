-- Replace buyer group memberships in bulk with optional default group retention
-- Executes in a single transaction
create or replace function replace_groups_for_buyers(
  buyer_ids uuid[],
  target_group_ids uuid[],
  keep_default boolean default false
) returns table(changed_rows int) language plpgsql as $$
declare
  default_group_id uuid;
  deleted_count int := 0;
  inserted_count int := 0;
  default_count int := 0;
  retain_default boolean := keep_default;
begin
  if retain_default then
    select id into default_group_id from groups where slug = 'all' limit 1;
    if default_group_id is null then
      retain_default := false;
    end if;
  end if;

  delete from buyer_groups
  where buyer_id = any(buyer_ids)
    and (not retain_default or group_id <> default_group_id);
  get diagnostics deleted_count = row_count;

  insert into buyer_groups (buyer_id, group_id)
  select b, g
  from unnest(buyer_ids) as b
  cross join unnest(target_group_ids) as g
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if retain_default then
    insert into buyer_groups (buyer_id, group_id)
    select b, default_group_id
    from unnest(buyer_ids) as b
    on conflict do nothing;
    get diagnostics default_count = row_count;
  end if;

  return query
  select (
    coalesce(deleted_count, 0) +
    coalesce(inserted_count, 0) +
    coalesce(default_count, 0)
  )::int as changed_rows;
end;
$$;
