# Archived migrations

The SQL files in this directory capture the historical Supabase migrations that pre-date the consolidated setup scripts in `/scripts`. New deployments should run the scripts plus `migrations/037-ensure-rls-policies.sql` from the repository root. Only apply the archived files when upgrading a legacy environment that is missing a specific column, table, or data cleanup.

Data maintenance helpers such as `012-revive-threads.sql` and `013-normalize-thread-phones.sql` remain available here for operators who still need to revive legacy messaging threads. Running them is optional and only required when migrating an existing production database that still contains the older records.
