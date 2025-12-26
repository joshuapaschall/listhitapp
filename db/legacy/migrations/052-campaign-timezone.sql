-- Add timezone tracking for campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS timezone text;

-- Preserve existing scheduling behavior for legacy rows
UPDATE campaigns
SET timezone = 'America/New_York'
WHERE timezone IS NULL;
