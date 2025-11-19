-- Add preferred_from_number to message_threads for sticky reply DIDs
ALTER TABLE message_threads
  ADD COLUMN IF NOT EXISTS preferred_from_number text;

CREATE INDEX IF NOT EXISTS idx_message_threads_preferred_from
  ON message_threads (preferred_from_number);

WITH last_inbound AS (
  SELECT
    thread_id,
    (array_agg(to_number ORDER BY created_at DESC))[1] AS did
  FROM messages
  WHERE direction = 'inbound' AND to_number IS NOT NULL
  GROUP BY thread_id
)
UPDATE message_threads mt
SET preferred_from_number = li.did
FROM last_inbound li
WHERE li.thread_id = mt.id
  AND mt.preferred_from_number IS NULL;
