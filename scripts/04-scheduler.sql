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
  '*/1 * * * *',
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

-- Requeue stuck email jobs
select cron.unschedule('requeue-stuck-email-jobs')
  where exists (select 1 from cron.job where jobname = 'requeue-stuck-email-jobs');

select cron.schedule(
  'requeue-stuck-email-jobs',
  '*/1 * * * *',
  $$select
      net.http_post(
        url := '${DISPOTOOL_BASE_URL}/api/email-campaigns/requeue-stuck',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization', 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}'
        ),
        body := jsonb_build_object('stuckSeconds', 300, 'limit', 100)
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
