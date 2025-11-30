-- Enable extensions (noop if already on)
create extension if not exists pg_net   with schema extensions;
create extension if not exists pg_cron  with schema pg_catalog;

-- Recreate cron job: every 5 min call Edge Function
select cron.unschedule('send-campaigns-every-5')
  where exists (select 1 from cron.job where jobname = 'send-campaigns-every-5');

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

-- Drive queued email batches
select cron.unschedule('process-email-queue')
  where exists (select 1 from cron.job where jobname = 'process-email-queue');

select cron.schedule(
  'process-email-queue',
  '*/5 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/email-campaigns/process',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization', 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}'
        ),
        body := jsonb_build_object('limit', 25)
      )$$
);

-- Recreate Gmail sync: every 5 min hit Next.js route
select cron.unschedule('sync-gmail-threads')
  where exists (select 1 from cron.job where jobname = 'sync-gmail-threads');

select cron.schedule(
  'sync-gmail-threads',
  '*/5 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/gmail/sync',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb
      )$$
);

-- Poll SendFox and Gmail for email metrics
select cron.unschedule('update-email-metrics')
  where exists (select 1 from cron.job where jobname = 'update-email-metrics');

select cron.schedule(
  'update-email-metrics',
  '*/5 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/email-metrics/update',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb
  )$$
);

-- Hourly SendFox reconciliation (dry-run by default)
select cron.unschedule('reconcile-sendfox-lists')
  where exists (select 1 from cron.job where jobname = 'reconcile-sendfox-lists');

select cron.schedule(
  'reconcile-sendfox-lists',
  '0 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/sendfox/reconcile',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization', 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}'
        ),
        body := jsonb_build_object('dryRun', true)
      )$$
);

-- Daily cleanup of expired Telnyx credentials
select cron.unschedule('cleanup-telnyx-creds')
  where exists (select 1 from cron.job where jobname = 'cleanup-telnyx-creds');

select cron.schedule(
  'cleanup-telnyx-creds',
  '0 0 * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/telnyx/cleanup',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb
      )$$
);
