# Product requirements

## Problem

Small and medium fulfillment operators need one reliable system for receiving, address storage, inventory and FBS order execution. Spreadsheet-based workflows create stock discrepancies, slow picking and make it difficult to prove who performed an operation.

## Product goal

Deliver a configurable WMS that a fulfillment company can start using without custom development, while preserving transactional inventory and a complete operational audit trail.

## Users

- Fulfillment owner: configures the company, warehouses, employees and commercial plan.
- Warehouse manager: controls throughput, stock and exceptions.
- Receiver: accepts boxes and contents.
- Picker: picks reserved stock using a handheld terminal or phone.
- Packer: packs and marks orders ready.
- Shipper: confirms handover.
- Seller/client: views only their inventory, orders and reports (future portal).

## P0 — commercial pilot

- All current warehouse operations remain transactional and auditable.
- Installable mobile PWA supports camera and keyboard/HID scanners.
- Git-based CI/CD, health endpoint and production error visibility are mandatory.
- Every business row belongs to an organization and warehouse before a second fulfillment is onboarded.
- Organization isolation is verified by automated negative tests.
- Backups, migration procedure and recovery instructions are documented.

## P1 — first sellable release

- Organization onboarding, warehouse settings and branding.
- Seller portal with scoped inventory and order visibility.
- Import/export for products, stock and orders.
- Wildberries integration with idempotent synchronization and retry queue.
- Operational reports: receiving, stock ageing, picking speed, errors and employee throughput.
- Configurable labels and print templates.

## P2 — scale

- Multiple warehouses per organization.
- Billing, plans, limits and trial lifecycle.
- API keys, webhooks and integration marketplace.
- Wave picking, replenishment and returns.
- Enterprise SSO and advanced audit export.

## Non-goals for the pilot

- 3D warehouse visualization.
- Native iOS/Android binaries while PWA covers the operator workflow.
- Automated billing before tenancy and metering are proven.
- Marketplace-specific features that weaken the core inventory model.

## Success measures

- 99.9% successful write operations excluding validation errors.
- Zero cross-organization data exposure in automated tests.
- Median scan-to-result time below one second on a warm system.
- Inventory discrepancy below 0.2% in a pilot stock count.
- New operator completes a standard task after no more than 15 minutes of training.
