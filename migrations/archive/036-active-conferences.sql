-- ACTIVE CONFERENCES TABLE AND ACCESS POLICIES

-- Create the active_conferences table when it does not already exist
CREATE TABLE IF NOT EXISTS public.active_conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id varchar(255) NOT NULL,
  call_sid varchar(255) NOT NULL,
  from_number varchar(50) NOT NULL,
  to_number varchar(50) NOT NULL,
  webrtc_joined boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  ended_at timestamptz
);

-- Ensure conference_id values remain unique
CREATE UNIQUE INDEX IF NOT EXISTS active_conferences_conference_id_key
  ON public.active_conferences (conference_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_active_conferences_created_at
  ON public.active_conferences (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_conferences_webrtc_joined
  ON public.active_conferences (webrtc_joined);

-- Enable row level security
ALTER TABLE public.active_conferences ENABLE ROW LEVEL SECURITY;

-- Reset existing policies so the migration is idempotent
DROP POLICY IF EXISTS "Service role can do everything" ON public.active_conferences;
DROP POLICY IF EXISTS "Authenticated users can read conferences" ON public.active_conferences;

-- Allow the Supabase service role full access
CREATE POLICY "Service role can do everything"
  ON public.active_conferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read the table
CREATE POLICY "Authenticated users can read conferences"
  ON public.active_conferences
  FOR SELECT
  TO authenticated
  USING (true);

-- Grants to align with the realtime API expectations
GRANT ALL ON public.active_conferences TO service_role;
GRANT SELECT ON public.active_conferences TO authenticated;
GRANT SELECT ON public.active_conferences TO anon;

-- Add the table to the Supabase realtime publication when missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'active_conferences'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.active_conferences';
  END IF;
END
$$;
