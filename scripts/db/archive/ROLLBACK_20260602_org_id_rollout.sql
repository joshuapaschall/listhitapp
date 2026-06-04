-- Roll back organization stamps from per-company tables while preserving all rows.

BEGIN;

DO $$
DECLARE
  target_table text;
  bucket_tables text[] := ARRAY[
    'buyers',
    'properties',
    'campaigns',
    'offers',
    'showings',
    'calls',
    'messages',
    'message_threads',
    'groups',
    'negative_keywords',
    'ai_prompts',
    'sms_templates',
    'email_templates',
    'quick_reply_templates',
    'short_links',
    'media_links',
    'voice_numbers',
    'notifications',
    'email_threads',
    'email_messages',
    'gmail_threads',
    'campaign_recipients',
    'email_events',
    'email_campaign_content',
    'email_campaign_queue',
    'sms_campaign_queue',
    'buyer_consents',
    'buyer_list_consent',
    'buyer_sms_senders',
    'buyer_groups',
    'property_buyers',
    'property_images',
    'sendfox_list_mismatches',
    'sendfox_list_sync_logs',
    'recording_access_log'
  ];
begin
  FOREACH target_table IN ARRAY bucket_tables
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', format('%s_org_id_idx', target_table));

    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS org_id', target_table);
  END LOOP;
END $$;

COMMIT;
