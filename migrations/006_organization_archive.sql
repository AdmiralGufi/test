BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_status_archived_idx
  ON organizations (status, archived_at, created_at DESC);

COMMIT;
