CREATE TABLE IF NOT EXISTS gmail_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  access_token text,
  refresh_token text NOT NULL,
  expires_at bigint,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
