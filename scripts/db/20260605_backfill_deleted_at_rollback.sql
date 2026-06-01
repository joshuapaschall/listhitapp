BEGIN;

-- No-op rollback: this backfill intentionally is not reversed.
-- Rows hidden by sendfox_hidden represented soft-deleted buyers, so clearing
-- deleted_at here could unintentionally un-delete buyers that should remain hidden.

COMMIT;
