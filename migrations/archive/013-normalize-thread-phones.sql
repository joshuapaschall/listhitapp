-- normalize phone_number values in message_threads
WITH cleaned AS (
  SELECT id, regexp_replace(phone_number, '\\D', '', 'g') AS digits
  FROM message_threads
)
UPDATE message_threads mt
SET    phone_number = CASE
         WHEN length(c.digits) = 11 AND c.digits LIKE '1%' THEN substr(c.digits, 2)
         ELSE c.digits
       END
FROM   cleaned c
WHERE  mt.id = c.id
  AND  phone_number IS DISTINCT FROM CASE
         WHEN length(c.digits) = 11 AND c.digits LIKE '1%' THEN substr(c.digits, 2)
         ELSE c.digits
       END;

-- remove duplicates created by normalization, keeping the earliest thread
DELETE FROM message_threads mt
USING (
  SELECT id,
         row_number() OVER (PARTITION BY buyer_id, phone_number ORDER BY created_at) AS rn
  FROM message_threads
) d
WHERE mt.id = d.id
  AND d.rn > 1;

-- enforce uniqueness on normalized values
DROP INDEX IF EXISTS unique_buyer_phone;
CREATE UNIQUE INDEX unique_buyer_phone ON message_threads (buyer_id, phone_number);
