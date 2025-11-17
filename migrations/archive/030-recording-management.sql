-- Update calls table for better recording management
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS telnyx_recording_id text,
ADD COLUMN IF NOT EXISTS recording_state text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS recording_duration_seconds integer,
ADD COLUMN IF NOT EXISTS recording_accessed_at timestamptz,
ADD COLUMN IF NOT EXISTS recording_accessed_by uuid REFERENCES agents(id);

-- Add indexes for recording queries
CREATE INDEX IF NOT EXISTS idx_calls_recording_state ON calls(recording_state);
CREATE INDEX IF NOT EXISTS idx_calls_started_at_desc ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_buyer ON calls(buyer_id);

-- Create recording access log for audit trail
CREATE TABLE IF NOT EXISTS recording_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text REFERENCES calls(call_sid),
  accessed_by uuid REFERENCES agents(id),
  access_type text CHECK (access_type IN ('play', 'download', 'share')),
  accessed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Create index for access log queries
CREATE INDEX IF NOT EXISTS idx_recording_access_call ON recording_access_log(call_sid);
CREATE INDEX IF NOT EXISTS idx_recording_access_agent ON recording_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_recording_access_time ON recording_access_log(accessed_at DESC);

-- Add search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create searchable text column with indexes
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS searchable tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(from_number,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(to_number,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(status,'')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_calls_search_gin ON calls USING gin(searchable);
CREATE INDEX IF NOT EXISTS idx_calls_from_trgm ON calls USING gin(from_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_to_trgm ON calls USING gin(to_number gin_trgm_ops);

-- Comments
COMMENT ON COLUMN calls.telnyx_recording_id IS 'Telnyx recording ID for fetching fresh URLs';
COMMENT ON COLUMN calls.recording_state IS 'State: pending, processing, saved, unavailable';
COMMENT ON COLUMN calls.recording_duration_seconds IS 'Duration of the recording in seconds';
COMMENT ON TABLE recording_access_log IS 'Audit trail for recording access';
