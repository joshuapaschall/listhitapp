BEGIN; DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
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
    'recording_access_log',
    'email_domains',
    'email_senders',
    'inbound_numbers',
    'markets',
    'org_voice_settings'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND table_type = 'BASE TABLE'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_delete', tbl);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND table_type = 'BASE TABLE'
  ) THEN
    DROP POLICY IF EXISTS "organizations_org_select" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_org_update" ON public.organizations;
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tags'
      AND table_type = 'BASE TABLE'
  ) THEN
    DROP POLICY IF EXISTS "tags_select_all" ON public.tags;
    ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'gmail_tokens',
    'user_integrations',
    'user_presence',
    'permissions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND table_type = 'BASE TABLE'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_user_all', tbl);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl);
  END LOOP;

  DROP FUNCTION IF EXISTS public.auth_org_id();

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'buyers'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "buyers_select_authenticated" ON public.buyers;
    CREATE POLICY "buyers_select_authenticated"
      ON public.buyers
      FOR SELECT
      TO authenticated
      USING (true);

    DROP POLICY IF EXISTS "buyers_insert_authenticated" ON public.buyers;
    CREATE POLICY "buyers_insert_authenticated"
      ON public.buyers
      FOR INSERT
      TO authenticated
      WITH CHECK (true);

    DROP POLICY IF EXISTS "buyers_update_authenticated" ON public.buyers;
    CREATE POLICY "buyers_update_authenticated"
      ON public.buyers
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);

    DROP POLICY IF EXISTS "buyers_delete_authenticated" ON public.buyers;
    CREATE POLICY "buyers_delete_authenticated"
      ON public.buyers
      FOR
      DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
COMMIT;
