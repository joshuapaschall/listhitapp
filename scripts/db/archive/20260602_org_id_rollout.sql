-- Add organization stamps to per-company tables for the current single-tenant org.

BEGIN;

DO $$
DECLARE
  canonical_org_id uuid;
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
  SELECT id INTO canonical_org_id
  FROM public.organizations
  ORDER BY created_at ASC
  LIMIT 1;

  IF canonical_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found — run org membership migration first';
  END IF;

  FOREACH target_table IN ARRAY bucket_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND table_type = 'BASE TABLE'
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'org_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN org_id uuid', target_table);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = target_table
        AND c.conname = format('%s_org_id_fkey', target_table)
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES public.organizations(id)',
        target_table,
        format('%s_org_id_fkey', target_table)
      );
    END IF;

    EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', target_table, canonical_org_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT %L::uuid', target_table, canonical_org_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', target_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)', format('%s_org_id_idx', target_table), target_table);
  END LOOP;
END $$;

COMMIT;
