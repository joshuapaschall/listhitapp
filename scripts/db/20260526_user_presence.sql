-- Add user presence tracking for inbound routing and clean up orphaned legacy table.

DROP TABLE IF EXISTS public.agents_sessions CASCADE;

CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sip_username text,
  status text NOT NULL CHECK (status IN ('online', 'offline')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  client_id text NOT NULL,
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS user_presence_online_idx
  ON public.user_presence (status, last_seen DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages user presence" ON public.user_presence;
CREATE POLICY "Service role manages user presence"
  ON public.user_presence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own presence" ON public.user_presence;
CREATE POLICY "Users manage own presence"
  ON public.user_presence
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
