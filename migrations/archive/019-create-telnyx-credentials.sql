CREATE TABLE IF NOT EXISTS telnyx_credentials (
  id text PRIMARY KEY,
  sip_username text NOT NULL,
  sip_password text NOT NULL,
  connection_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
