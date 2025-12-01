-- Track SendFox list sync runs and mismatches
create table if not exists sendfox_list_sync_logs (
  id uuid primary key default gen_random_uuid(),
  list_id integer not null,
  group_id uuid,
  status text not null check (status in ('success','error','dry_run')),
  mismatches integer not null default 0,
  applied boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists sendfox_list_sync_logs_list_idx on sendfox_list_sync_logs(list_id);
create index if not exists sendfox_list_sync_logs_created_idx on sendfox_list_sync_logs(created_at desc);

create table if not exists sendfox_list_mismatches (
  id uuid primary key default gen_random_uuid(),
  list_id integer not null,
  group_id uuid,
  email text not null,
  issue text not null check (issue in ('missing_in_sendfox','missing_in_crm')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sendfox_list_mismatches_list_idx on sendfox_list_mismatches(list_id);
create index if not exists sendfox_list_mismatches_resolved_idx on sendfox_list_mismatches(resolved);
