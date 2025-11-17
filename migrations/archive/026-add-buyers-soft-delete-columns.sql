-- Soft-delete support for buyers

-- 1) Add columns if missing
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS sendfox_hidden boolean,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2) Ensure default + not-null on sendfox_hidden
ALTER TABLE buyers
  ALTER COLUMN sendfox_hidden SET DEFAULT false;

-- Backfill existing NULLs to false
UPDATE buyers
SET sendfox_hidden = false
WHERE sendfox_hidden IS NULL;

-- Now enforce NOT NULL
ALTER TABLE buyers
  ALTER COLUMN sendfox_hidden SET NOT NULL;

-- 3) Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_buyers_sendfox_hidden ON buyers(sendfox_hidden);
CREATE INDEX IF NOT EXISTS idx_buyers_deleted_at ON buyers(deleted_at);
