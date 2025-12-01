-- Add buyer and group recipient tracking arrays to campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS buyer_ids uuid[];

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS group_ids uuid[];
