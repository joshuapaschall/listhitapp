BEGIN;

UPDATE sites SET template_id = 'aspen'   WHERE template_id = 'marquee';
UPDATE sites SET template_id = 'cedar'   WHERE template_id = 'haven';
UPDATE sites SET template_id = 'madrone' WHERE template_id = 'vantage';
UPDATE sites SET template_id = 'oak'     WHERE template_id = 'forge';

ALTER TABLE sites ALTER COLUMN template_id SET DEFAULT 'aspen';

COMMIT;
