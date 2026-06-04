-- Roll back auth.users foreign-key delete behavior to the default NO ACTION.
--
-- This escape hatch restores the same constraint names used by the forward
-- migration, but re-adds each foreign key without an ON DELETE clause.
-- profiles.id -> auth.users(id) is intentionally left unchanged.

BEGIN;

ALTER TABLE public.gmail_tokens
  DROP CONSTRAINT IF EXISTS gmail_tokens_user_id_fkey;
ALTER TABLE public.gmail_tokens
  ADD CONSTRAINT gmail_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.permissions
  DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;
ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.user_integrations
  DROP CONSTRAINT IF EXISTS user_integrations_user_id_fkey;
ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.user_presence
  DROP CONSTRAINT IF EXISTS user_presence_user_id_fkey;
ALTER TABLE public.user_presence
  ADD CONSTRAINT user_presence_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_user_id_fkey;
ALTER TABLE public.calls
  ADD CONSTRAINT calls_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_user_id_fkey;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.short_links
  DROP CONSTRAINT IF EXISTS short_links_created_by_fkey;
ALTER TABLE public.short_links
  ADD CONSTRAINT short_links_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.showings
  DROP CONSTRAINT IF EXISTS showings_created_by_fkey;
ALTER TABLE public.showings
  ADD CONSTRAINT showings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_created_by_fkey;
ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.email_builder_templates
  DROP CONSTRAINT IF EXISTS email_builder_templates_created_by_fkey;
ALTER TABLE public.email_builder_templates
  ADD CONSTRAINT email_builder_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.email_campaign_definitions
  DROP CONSTRAINT IF EXISTS email_campaign_definitions_created_by_fkey;
ALTER TABLE public.email_campaign_definitions
  ADD CONSTRAINT email_campaign_definitions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.email_campaign_queue
  DROP CONSTRAINT IF EXISTS email_campaign_queue_created_by_fkey;
ALTER TABLE public.email_campaign_queue
  ADD CONSTRAINT email_campaign_queue_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

COMMIT;
