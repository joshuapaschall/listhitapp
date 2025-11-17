CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role in ('user','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION create_profile()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles(id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION create_profile();
