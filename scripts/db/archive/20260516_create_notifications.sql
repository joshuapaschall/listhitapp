-- General-purpose notifications table (powers sidebar activity feed + future notification center)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Realtime for live sidebar feed
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
