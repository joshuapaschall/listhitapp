CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  permission_key text,
  granted boolean NOT NULL,
  CONSTRAINT permissions_user_key UNIQUE (user_id, permission_key)
);
