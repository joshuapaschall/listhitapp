DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'agent_active_calls'
  ) THEN
    EXECUTE $$
      ALTER TABLE agent_active_calls
      ADD COLUMN IF NOT EXISTS hold_state text DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS playback_state text DEFAULT 'idle',
      ADD COLUMN IF NOT EXISTS last_playback_cmd_id uuid,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
    $$;

    EXECUTE $$
      CREATE INDEX IF NOT EXISTS idx_agent_active_calls_hold_state
      ON agent_active_calls(hold_state)
    $$;

    EXECUTE $$
      COMMENT ON COLUMN agent_active_calls.hold_state IS 'Current hold state: active | holding'
    $$;

    EXECUTE $$
      COMMENT ON COLUMN agent_active_calls.playback_state IS 'Playback state: idle | starting | playing | stopping'
    $$;

    EXECUTE $$
      COMMENT ON COLUMN agent_active_calls.last_playback_cmd_id IS 'Last playback command ID for idempotency'
    $$;
  END IF;
END;
$$;
