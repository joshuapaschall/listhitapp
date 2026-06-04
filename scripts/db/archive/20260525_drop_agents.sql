-- Destructive migration: run AFTER the deploy that removes agent subsystem code.

DROP FUNCTION IF EXISTS public.verify_agent_password(text, text) CASCADE;

DROP TABLE IF EXISTS public.agent_events, public.calls_sessions, public.agent_active_calls, public.agent_sessions CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;

DROP INDEX IF EXISTS public.calls_from_agent_idx;
ALTER TABLE public.calls DROP COLUMN IF EXISTS from_agent_id;
