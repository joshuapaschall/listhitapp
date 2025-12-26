-- AGENTS TABLES FOR CALL CENTER
-- Minimal implementation for 5 agents handling queue

-- Drop existing tables if needed (for clean setup)
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Agents table - stores agent credentials and status
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  sip_username text UNIQUE NOT NULL,         -- e.g., 'agent1'
  telephony_credential_id text,              -- From Telnyx portal
  status text DEFAULT 'offline' CHECK (status IN ('available','busy','offline')),
  last_call_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent sessions - tracks active WebRTC connections
CREATE TABLE agent_sessions (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  call_control_id text UNIQUE NOT NULL,      -- For bridging calls
  jwt_expires_at timestamptz,                -- Track token expiry
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_email ON agents(email);
CREATE INDEX idx_agent_sessions_call_control ON agent_sessions(call_control_id);

-- Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (agents table is not user-facing)
CREATE POLICY "Service role can manage agents" ON agents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage agent sessions" ON agent_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Helper function to verify agent password
CREATE OR REPLACE FUNCTION verify_agent_password(agent_email text, password text)
RETURNS TABLE(id uuid, email text, display_name text, sip_username text, telephony_credential_id text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.email, a.display_name, a.sip_username, a.telephony_credential_id, a.status
  FROM agents a
  WHERE a.email = agent_email 
    AND a.password_hash = crypt(password, a.password_hash);
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add missing columns to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS bridged_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hangup_source text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hangup_cause text;

