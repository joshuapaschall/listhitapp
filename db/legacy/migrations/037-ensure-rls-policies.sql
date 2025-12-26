-- ENSURE RLS POLICIES FOR CALL CENTER AND SUPPORT TABLES

-- Agents table
ALTER TABLE IF EXISTS public.agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage agents" ON public.agents;
CREATE POLICY "Service role can manage agents"
  ON public.agents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Agent sessions table
ALTER TABLE IF EXISTS public.agent_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage agent sessions" ON public.agent_sessions;
CREATE POLICY "Service role can manage agent sessions"
  ON public.agent_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Agent active calls
ALTER TABLE IF EXISTS public.agent_active_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage agent_active_calls" ON public.agent_active_calls;
CREATE POLICY "Service role can manage agent_active_calls"
  ON public.agent_active_calls
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Call transfers
ALTER TABLE IF EXISTS public.call_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage call_transfers" ON public.call_transfers;
CREATE POLICY "Service role can manage call_transfers"
  ON public.call_transfers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Calls sessions map
ALTER TABLE IF EXISTS public.calls_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage calls_sessions" ON public.calls_sessions;
CREATE POLICY "Service role can manage calls_sessions"
  ON public.calls_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Agent events stream
ALTER TABLE IF EXISTS public.agent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage agent_events" ON public.agent_events;
CREATE POLICY "Service role can manage agent_events"
  ON public.agent_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Recording access log
ALTER TABLE IF EXISTS public.recording_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage recording_access_log" ON public.recording_access_log;
CREATE POLICY "Service role can manage recording_access_log"
  ON public.recording_access_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Active conferences
ALTER TABLE IF EXISTS public.active_conferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can do everything" ON public.active_conferences;
DROP POLICY IF EXISTS "Authenticated users can read conferences" ON public.active_conferences;
CREATE POLICY "Service role can do everything"
  ON public.active_conferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated users can read conferences"
  ON public.active_conferences
  FOR SELECT
  TO authenticated
  USING (true);

-- AI prompts (prompt library)
ALTER TABLE IF EXISTS public.ai_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Authenticated users can manage ai_prompts" ON public.ai_prompts;
CREATE POLICY "Service role can manage ai_prompts"
  ON public.ai_prompts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Authenticated users can manage ai_prompts"
  ON public.ai_prompts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Telnyx credentials (service managed)
ALTER TABLE IF EXISTS public.telnyx_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage telnyx_credentials" ON public.telnyx_credentials;
CREATE POLICY "Service role can manage telnyx_credentials"
  ON public.telnyx_credentials
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Permissions (user capability flags)
ALTER TABLE IF EXISTS public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can view their permissions" ON public.permissions;
CREATE POLICY "Service role can manage permissions"
  ON public.permissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Users can view their permissions"
  ON public.permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Gmail OAuth tokens
ALTER TABLE IF EXISTS public.gmail_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage gmail_tokens" ON public.gmail_tokens;
CREATE POLICY "Service role can manage gmail_tokens"
  ON public.gmail_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
