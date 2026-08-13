# Architecture

## Current system

```text
Phone / TSD / Desktop
        │
        ▼
Next.js PWA on Vercel
        │ authenticated server routes
        ▼
Neon PostgreSQL
        │
        ├─ transactional WMS functions
        └─ audit and scan events
```

Inventory-changing operations execute through PostgreSQL functions so a partial request cannot leave stock, boxes and orders out of sync. The browser never receives `DATABASE_URL`.

## Module boundaries

- Identity: users, sessions and role checks.
- Master data: organizations, warehouses, sellers, products, zones and cells.
- Inbound: receipts, boxes and box contents.
- Inventory: balances and stock movements.
- Outbound: orders, reservations, picking, packing and shipping.
- Devices: PWA, phones, TSD pairing and scan events.
- Audit/observability: business audit log, health checks and structured runtime logs.
- Integrations: marketplace adapters, imports, exports and webhooks.

## Multi-tenant target

Before onboarding a second fulfillment, introduce `organizations`, `organization_members` and `warehouses`. Add `organization_id` and, where applicable, `warehouse_id` to all business tables. Existing data is assigned to the initial organization during a staged Neon migration.

Isolation must be enforced twice:

1. Every server query is scoped using the organization from the authenticated session.
2. PostgreSQL policies/constraints prevent accidental cross-organization references.

Current API writes also perform explicit ownership checks before invoking transactional WMS functions. Unknown and foreign IDs return the same unavailable response so the API does not reveal whether another organization owns an object.

Seller records remain customers of a fulfillment organization; they are not tenants themselves.

## Extension rules

- New writes use explicit actions in `lib/wms-contract.js` and `POST /api/ops` until a module warrants its own route.
- Marketplace code must depend on internal service contracts, never update inventory tables directly.
- Schema changes are versioned in `migrations/` and tested on a Neon branch.
- External events require idempotency keys.
- Logs may contain identifiers and timings, but never passwords, tokens or database URLs.
