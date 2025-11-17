-- revive recently-active soft-deleted threads
UPDATE message_threads mt
SET    deleted_at = NULL
WHERE  deleted_at IS NOT NULL
  AND  EXISTS (
        SELECT 1 FROM messages m
        WHERE m.thread_id = mt.id
          AND m.created_at > now() - interval '90 days'
      );
