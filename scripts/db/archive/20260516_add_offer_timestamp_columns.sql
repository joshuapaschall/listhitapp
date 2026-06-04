-- Add missing timestamp columns to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS countered_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS closed_at timestamptz;
