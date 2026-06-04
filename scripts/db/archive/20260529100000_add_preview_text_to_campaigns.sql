-- Campaign-level preview_text shown in the inbox after the subject line.
-- Surfaced via the Subject card's "Preview Text" input in
-- components/campaigns/campaign-compose-view.tsx and whitelisted in the PATCH
-- /api/campaigns/[campaignId] handler. The column was missing from the schema,
-- causing the autosave to fail with PGRST204 ("column does not exist") any time
-- the user touched the Preview Text input. See production audit 2026-05-29.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS preview_text text;
