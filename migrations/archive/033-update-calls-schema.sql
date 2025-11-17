-- Add WebRTC tracking and agent metadata to calls
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS webrtc boolean NOT NULL DEFAULT false;

ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS from_agent_id uuid REFERENCES public.agents(id);

ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS recording_confidence double precision;

CREATE INDEX IF NOT EXISTS idx_calls_from_agent ON public.calls(from_agent_id);
