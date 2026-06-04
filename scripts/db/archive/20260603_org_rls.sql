BEGIN; DO $$ DECLARE tbl text; BEGIN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $function$';

  GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated;

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

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF tbl = 'buyers' THEN
      EXECUTE 'DROP POLICY IF EXISTS "buyers_select_authenticated" ON public.buyers';
      EXECUTE 'DROP POLICY IF EXISTS "buyers_insert_authenticated" ON public.buyers';
      EXECUTE 'DROP POLICY IF EXISTS "buyers_update_authenticated" ON public.buyers';
      EXECUTE 'DROP POLICY IF EXISTS "buyers_delete_authenticated" ON public.buyers';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_authenticated', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_select', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (org_id = auth_org_id())', tbl || '_org_select', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (org_id = auth_org_id())', tbl || '_org_insert', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_update', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id())', tbl || '_org_update', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (org_id = auth_org_id())', tbl || '_org_delete', tbl);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "organizations_org_select" ON public.organizations;
    CREATE POLICY "organizations_org_select"
      ON public.organizations
      FOR SELECT
      TO authenticated
      USING (id = auth_org_id());

    DROP POLICY IF EXISTS "organizations_org_update" ON public.organizations;
    CREATE POLICY "organizations_org_update"
      ON public.organizations
      FOR UPDATE
      TO authenticated
      USING (id = auth_org_id())
      WITH CHECK (id = auth_org_id());
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tags'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "tags_select_all" ON public.tags;
    CREATE POLICY "tags_select_all"
      ON public.tags
      FOR SELECT
      TO authenticated
      USING (true);
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

    -- Skip this user-scoped table if it does not have user_id.
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'user_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_user_all', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', tbl || '_user_all', tbl);
  END LOOP;
END $$;
COMMIT;
