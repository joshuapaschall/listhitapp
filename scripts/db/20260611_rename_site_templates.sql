BEGIN;

-- Remap any existing rows (no-op if none exist)
UPDATE sites SET template_id = 'marquee' WHERE template_id = 'aspen';
UPDATE sites SET template_id = 'haven'   WHERE template_id = 'cedar';
UPDATE sites SET template_id = 'vantage' WHERE template_id = 'madrone';
UPDATE sites SET template_id = 'forge'   WHERE template_id = 'oak';

-- New default for future rows
ALTER TABLE sites ALTER COLUMN template_id SET DEFAULT 'marquee';

COMMIT;
