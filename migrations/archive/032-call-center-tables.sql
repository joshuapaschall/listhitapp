-- CALL CENTER SUPPORT TABLES

-- Ensure timestamp update trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agent active calls tracks realtime call legs for each agent
CREATE TABLE IF NOT EXISTS agent_active_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid UNIQUE REFERENCES public.agents(id),
  customer_leg_id text,
  agent_leg_id text,
  consult_leg_id text,
  hold_state text DEFAULT 'active',
  playback_state text DEFAULT 'idle',
  last_playback_cmd_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_active_calls_agent ON agent_active_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_active_calls_hold_state ON agent_active_calls(hold_state);

COMMENT ON COLUMN agent_active_calls.hold_state IS 'Current hold state: active | holding';
COMMENT ON COLUMN agent_active_calls.playback_state IS 'Playback state: idle | starting | playing | stopping';
COMMENT ON COLUMN agent_active_calls.last_playback_cmd_id IS 'Last playback command ID for idempotency';

CREATE TRIGGER update_agent_active_calls_updated_at
  BEFORE UPDATE ON agent_active_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agent_active_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage agent_active_calls" ON agent_active_calls
  FOR ALL USING (auth.role() = 'service_role');

-- Call transfers keeps a record of warm/cold transfers in progress
CREATE TABLE IF NOT EXISTS call_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_control_id text NOT NULL,
  transfer_type text NOT NULL,
  destination text NOT NULL,
  consult_leg_id text,
  status text NOT NULL DEFAULT 'pending',
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_call_transfers_control_id ON call_transfers(call_control_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_consult_leg ON call_transfers(consult_leg_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_status ON call_transfers(status);

ALTER TABLE call_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage call_transfers" ON call_transfers
  FOR ALL USING (auth.role() = 'service_role');

-- Call session map between agent sessions and customer calls
CREATE TABLE IF NOT EXISTS calls_sessions (
  agent_session_id text PRIMARY KEY,
  customer_call_control_id text NOT NULL UNIQUE,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER update_calls_sessions_updated_at
  BEFORE UPDATE ON calls_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE calls_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage calls_sessions" ON calls_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Agent events stores realtime event payloads
CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage agent_events" ON agent_events
  FOR ALL USING (auth.role() = 'service_role');
