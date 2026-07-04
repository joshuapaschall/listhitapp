-- C1b: inbound conference no-answer state machine.
BEGIN;

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS agent_legs_remaining int,
  ADD COLUMN IF NOT EXISTS agent_answered boolean NOT NULL DEFAULT false;

-- Atomic decrement so concurrent agent-leg callbacks can't race the counter.
-- Returns the post-decrement remaining count and the current answered flag.
CREATE OR REPLACE FUNCTION public.note_twilio_agent_leg_ended(p_call_sid text)
RETURNS TABLE(remaining int, answered boolean)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.calls
    SET agent_legs_remaining = GREATEST(COALESCE(agent_legs_remaining, 0) - 1, 0)
    WHERE call_sid = p_call_sid
    RETURNING agent_legs_remaining, COALESCE(agent_answered, false)
    INTO remaining, answered;
  RETURN NEXT;
END $$;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.note_twilio_agent_leg_ended(text);
-- ALTER TABLE public.calls DROP COLUMN IF EXISTS agent_legs_remaining, DROP COLUMN IF EXISTS agent_answered;
-- COMMIT;
