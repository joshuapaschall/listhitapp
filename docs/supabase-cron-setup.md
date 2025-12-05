# Supabase cron setup for scheduled campaigns and email queue

Follow these steps to replace any legacy cron job with the current workflow that calls the `send-scheduled-campaigns` edge function and the `/api/email-queue/process` dispatcher.

## 1) Deploy the edge function (CLI, not SQL editor)

Use the Supabase CLI to deploy the code in `supabase/functions/send-scheduled-campaigns`. Pasting that TypeScript into the SQL editor will throw a `syntax error at or near " / "` because the SQL editor only accepts SQL.

```bash
supabase functions deploy send-scheduled-campaigns
```

This uploads the function to your project using the project ID in `supabase/config.toml`.

## 2) Confirm required secrets

Set these secrets in your Supabase project (SQL editor → **Secrets** tab or `supabase secrets set ...`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISPOTOOL_BASE_URL` (or `SITE_URL`) pointing at the deployed Next.js site
- `FUNCTION_URL` (the public URL of the deployed `send-scheduled-campaigns` function)

Example command:

```bash
supabase secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  DISPOTOOL_BASE_URL=https://app.listhit.io \
  FUNCTION_URL=https://<project>.supabase.co/functions/v1/send-scheduled-campaigns
```

## 3) Remove the old cron job (if any)

If you previously scheduled a different job name for sending campaigns, unschedule it first in the SQL editor:

```sql
select cron.unschedule('send-campaigns-every-5')
  where exists (select 1 from cron.job where jobname = 'send-campaigns-every-5');
```

If you used a different job name, replace `'send-campaigns-every-5'` with the exact name from `cron.job`.

## 4) Create the updated cron jobs

Run the contents of `scripts/04-scheduler.sql` in the Supabase SQL editor (or run `pnpm run db:schedule` locally). The key statements are:

```sql
-- call the edge function every 5 minutes
select cron.schedule(
  'send-campaigns-every-5',
  '*/5 * * * *',
  $$select
      net.http_post(
        url := '${FUNCTION_URL}',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb
      )$$
);

-- dispatch pending email queue jobs every 5 minutes via Next.js
select cron.schedule(
  'process-email-queue',
  '*/5 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/email-queue/process',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization', 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}'
        ),
        body := '{}'::jsonb
      )$$
);
```

The `${...}` placeholders are replaced automatically when running `pnpm run db:schedule`; in the Supabase SQL editor, ensure the referenced secrets exist so the `net.http_post` calls succeed.

## 5) Verify the jobs

In the SQL editor, confirm both jobs exist:

```sql
select jobid, jobname, schedule from cron.job
where jobname in ('send-campaigns-every-5', 'process-email-queue');
```

You should see one row per job with the `*/5 * * * *` schedule. If a job is missing, re-run step 4 after double-checking your secrets.
