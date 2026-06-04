BEGIN;

-- profiles policies are intentionally untouched.

DROP POLICY IF EXISTS "authenticated all on buyers" ON public.buyers;
DROP POLICY IF EXISTS "authenticated all on properties" ON public.properties;
DROP POLICY IF EXISTS "authenticated all on campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "authenticated all on campaign_recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "authenticated all on offers" ON public.offers;
DROP POLICY IF EXISTS "authenticated all on showings" ON public.showings;
DROP POLICY IF EXISTS "showings_select" ON public.showings;
DROP POLICY IF EXISTS "showings_write" ON public.showings;
DROP POLICY IF EXISTS "authenticated all on groups" ON public.groups;
DROP POLICY IF EXISTS "groups_select" ON public.groups;
DROP POLICY IF EXISTS "groups_write" ON public.groups;
DROP POLICY IF EXISTS "authenticated all on tags" ON public.tags;
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_write" ON public.tags;
DROP POLICY IF EXISTS "authenticated all on negative_keywords" ON public.negative_keywords;
DROP POLICY IF EXISTS "negative_keywords_select" ON public.negative_keywords;
DROP POLICY IF EXISTS "negative_keywords_write" ON public.negative_keywords;
DROP POLICY IF EXISTS "Authenticated users can manage ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "authenticated all on ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "authenticated all on sms_templates" ON public.sms_templates;
DROP POLICY IF EXISTS "authenticated all on quick_reply_templates" ON public.quick_reply_templates;
DROP POLICY IF EXISTS "authenticated all on email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users manage their email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users manage their email_campaign_queue" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "Email events readable" ON public.email_events;
DROP POLICY IF EXISTS "authenticated all on media_links" ON public.media_links;
DROP POLICY IF EXISTS "authenticated all on sendfox_list_mismatches" ON public.sendfox_list_mismatches;
DROP POLICY IF EXISTS "authenticated all on sendfox_list_sync_logs" ON public.sendfox_list_sync_logs;
DROP POLICY IF EXISTS "authenticated read buyer_consents" ON public.buyer_consents;
DROP POLICY IF EXISTS "authenticated all on buyer_list_consent" ON public.buyer_list_consent;
DROP POLICY IF EXISTS "authenticated all on buyer_sms_senders" ON public.buyer_sms_senders;
DROP POLICY IF EXISTS "authenticated all on buyer_groups" ON public.buyer_groups;
DROP POLICY IF EXISTS "buyer_groups_select" ON public.buyer_groups;
DROP POLICY IF EXISTS "buyer_groups_write" ON public.buyer_groups;
DROP POLICY IF EXISTS "authenticated all on property_buyers" ON public.property_buyers;
DROP POLICY IF EXISTS "property_buyers_select" ON public.property_buyers;
DROP POLICY IF EXISTS "property_buyers_write" ON public.property_buyers;
DROP POLICY IF EXISTS "authenticated all on property_images" ON public.property_images;
DROP POLICY IF EXISTS "property_images_select" ON public.property_images;
DROP POLICY IF EXISTS "property_images_write" ON public.property_images;
DROP POLICY IF EXISTS "authenticated all on email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "email_messages_select" ON public.email_messages;
DROP POLICY IF EXISTS "email_messages_write" ON public.email_messages;
DROP POLICY IF EXISTS "authenticated all on email_threads" ON public.email_threads;
DROP POLICY IF EXISTS "email_threads_select" ON public.email_threads;
DROP POLICY IF EXISTS "email_threads_write" ON public.email_threads;
DROP POLICY IF EXISTS "authenticated all on gmail_threads" ON public.gmail_threads;
DROP POLICY IF EXISTS "gmail_threads_select" ON public.gmail_threads;
DROP POLICY IF EXISTS "gmail_threads_write" ON public.gmail_threads;
DROP POLICY IF EXISTS "messages delete authenticated" ON public.messages;
DROP POLICY IF EXISTS "messages insert authenticated" ON public.messages;
DROP POLICY IF EXISTS "messages select active" ON public.messages;
DROP POLICY IF EXISTS "messages update authenticated" ON public.messages;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_write" ON public.messages;
DROP POLICY IF EXISTS "message_threads delete authenticated" ON public.message_threads;
DROP POLICY IF EXISTS "message_threads insert authenticated" ON public.message_threads;
DROP POLICY IF EXISTS "message_threads select active" ON public.message_threads;
DROP POLICY IF EXISTS "message_threads update authenticated" ON public.message_threads;
DROP POLICY IF EXISTS "message_threads_select" ON public.message_threads;
DROP POLICY IF EXISTS "message_threads_write" ON public.message_threads;
DROP POLICY IF EXISTS "voice_numbers read" ON public.voice_numbers;
DROP POLICY IF EXISTS "Read voice numbers" ON public.voice_numbers;

DROP POLICY IF EXISTS "messages_org_select" ON public.messages;
CREATE POLICY "messages_org_select" ON public.messages FOR SELECT TO authenticated USING (org_id = auth_org_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "message_threads_org_select" ON public.message_threads;
CREATE POLICY "message_threads_org_select" ON public.message_threads FOR SELECT TO authenticated USING (org_id = auth_org_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Service role manages user presence" ON public.user_presence;
CREATE POLICY "user_presence_service_all" ON public.user_presence FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
