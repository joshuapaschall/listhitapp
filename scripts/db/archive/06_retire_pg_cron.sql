-- Run AFTER confirming Vercel cron is firing emails. Removes the broken pg_cron jobs.
select cron.unschedule('send-scheduled-campaigns')  where exists (select 1 from cron.job where jobname='send-scheduled-campaigns');
select cron.unschedule('process-email-queue')       where exists (select 1 from cron.job where jobname='process-email-queue');
select cron.unschedule('requeue-stuck-email-jobs')  where exists (select 1 from cron.job where jobname='requeue-stuck-email-jobs');
-- Keep sync-gmail-threads — it's working.
select jobid, jobname, schedule, active from cron.job order by jobid;
