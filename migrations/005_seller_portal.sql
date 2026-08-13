BEGIN;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('ADMIN','MANAGER','RECEIVER','PICKER','PACKER','SHIPPER','VIEWER','SELLER'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN','MANAGER','RECEIVER','PICKER','PACKER','SHIPPER','VIEWER','SELLER'));

CREATE UNIQUE INDEX IF NOT EXISTS sellers_organization_id_id_key
  ON sellers (organization_id, id);

CREATE TABLE IF NOT EXISTS seller_members (
  organization_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  user_id uuid NOT NULL,
  access_role text NOT NULL DEFAULT 'VIEWER',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_members_pkey PRIMARY KEY (organization_id, seller_id, user_id),
  CONSTRAINT seller_members_organization_user_key UNIQUE (organization_id, user_id),
  CONSTRAINT seller_members_access_role_check CHECK (access_role IN ('OWNER','VIEWER')),
  CONSTRAINT seller_members_seller_fkey
    FOREIGN KEY (organization_id, seller_id)
    REFERENCES sellers (organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT seller_members_membership_fkey
    FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_members (organization_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS seller_members_seller_active_idx
  ON seller_members (seller_id, active);

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address text;

COMMIT;
