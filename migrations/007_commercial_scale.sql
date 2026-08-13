BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status text;

UPDATE organizations
SET billing_status=CASE WHEN status='TRIAL' THEN 'TRIALING' ELSE 'MANUAL' END
WHERE billing_status IS NULL;

UPDATE organizations
SET trial_ends_at=created_at+interval '14 days'
WHERE status='TRIAL' AND trial_ends_at IS NULL;

ALTER TABLE organizations ALTER COLUMN billing_status SET DEFAULT 'MANUAL';
ALTER TABLE organizations ADD CONSTRAINT organizations_billing_status_check
  CHECK (billing_status IN ('TRIALING','ACTIVE','PAST_DUE','CANCELLED','MANUAL')) NOT VALID;
ALTER TABLE organizations VALIDATE CONSTRAINT organizations_billing_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_billing_status_not_null
  CHECK (billing_status IS NOT NULL) NOT VALID;
ALTER TABLE organizations VALIDATE CONSTRAINT organizations_billing_status_not_null;
ALTER TABLE organizations ALTER COLUMN billing_status SET NOT NULL;
ALTER TABLE organizations DROP CONSTRAINT organizations_billing_status_not_null;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_id uuid;
UPDATE orders o
SET warehouse_id=(
  SELECT w.id FROM sellers s JOIN warehouses w ON w.organization_id=s.organization_id
  WHERE s.id=o.seller_id AND w.active=true ORDER BY w.created_at LIMIT 1
)
WHERE o.warehouse_id IS NULL;
ALTER TABLE orders ADD CONSTRAINT orders_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_warehouse_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_warehouse_id_not_null CHECK (warehouse_id IS NOT NULL) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_warehouse_id_not_null;
ALTER TABLE orders ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT orders_warehouse_id_not_null;

ALTER TABLE wb_integrations ADD COLUMN IF NOT EXISTS warehouse_id uuid;
UPDATE wb_integrations i
SET warehouse_id=(
  SELECT w.id FROM warehouses w WHERE w.organization_id=i.organization_id AND w.active=true
  ORDER BY w.created_at LIMIT 1
)
WHERE i.warehouse_id IS NULL;
ALTER TABLE wb_integrations ADD CONSTRAINT wb_integrations_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) NOT VALID;
ALTER TABLE wb_integrations VALIDATE CONSTRAINT wb_integrations_warehouse_id_fkey;
ALTER TABLE wb_integrations ADD CONSTRAINT wb_integrations_warehouse_id_not_null CHECK (warehouse_id IS NOT NULL) NOT VALID;
ALTER TABLE wb_integrations VALIDATE CONSTRAINT wb_integrations_warehouse_id_not_null;
ALTER TABLE wb_integrations ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE wb_integrations DROP CONSTRAINT wb_integrations_warehouse_id_not_null;

CREATE INDEX IF NOT EXISTS orders_warehouse_created_idx ON orders (warehouse_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wb_integrations_warehouse_active_idx ON wb_integrations (warehouse_id,active);
CREATE INDEX IF NOT EXISTS organizations_trial_lifecycle_idx ON organizations (status,trial_ends_at) WHERE archived_at IS NULL;

COMMIT;
