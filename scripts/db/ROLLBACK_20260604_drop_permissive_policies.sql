-- EMERGENCY ONLY — this reintroduces cross-org visibility; use only if the app breaks while still single-tenant.
BEGIN;

DO $$
DECLARE
  table_name text;
begin
  FOREACH table_name IN ARRAY ARRAY[
    'buyers',
    'properties',
    'campaigns',
    'campaign_recipients',
    'offers',
    'showings',
    'groups',
    'tags',
    'negative_keywords',
    'ai_prompts',
    'sms_templates',
    'quick_reply_templates',
    'email_templates',
    'email_events',
    'media_links',
    'sendfox_list_mismatches',
    'sendfox_list_sync_logs',
    'buyer_consents',
    'buyer_list_consent',
    'buyer_sms_senders',
    'buyer_groups',
    'property_buyers',
    'property_images',
    'email_messages',
    'email_threads',
    'gmail_threads',
    'messages',
    'message_threads'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated all on ' || table_name, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated all on ' || table_name, table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "messages_org_select" ON public.messages;
CREATE POLICY "messages_org_select" ON public.messages FOR SELECT TO authenticated USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "message_threads_org_select" ON public.message_threads;
CREATE POLICY "message_threads_org_select" ON public.message_threads FOR SELECT TO authenticated USING (org_id = auth_org_id());

COMMIT;
