ALTER TABLE voice_numbers
ADD COLUMN IF NOT EXISTS connection_id text,
ADD COLUMN IF NOT EXISTS messaging_profile_id text,
ADD COLUMN IF NOT EXISTS tags text[];
