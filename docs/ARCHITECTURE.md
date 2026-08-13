# Architecture

## Current system

```text
Phone / TSD / Desktop
        │
        ▼
Next.js PWA on Vercel
        │ authenticated server routes + scheduled sync
        ▼
Neon PostgreSQL
        │
        ├─ transactional WMS functions
        ├─ encrypted marketplace credentials
        └─ audit, scan and import events

Wildberries Marketplace API sends new FBS orders through a server-only adapter. The adapter validates the Marketplace token, polls the new-orders endpoint, maps products by WB identifiers or barcode and imports every WB order exactly once. Tokens are encrypted before storage and are never returned by the bootstrap API. On the current Hobby deployment, GitHub Actions calls the protected sync endpoint every five minutes while Vercel keeps a daily fallback; an open operator cabinet also checks every minute.
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

## Multi-tenant model

The platform owner manages fulfillment organizations. Each organization has isolated warehouses, employees, clients, stock and orders. A fulfillment client is represented by a seller record and may have one seller-scoped login per organization. The client portal exposes aggregates by warehouse and city but never internal cells, staff, audit logs or another seller's data.

Isolation must be enforced twice:

1. Every server query is scoped using the organization from the authenticated session.
2. PostgreSQL policies/constraints prevent accidental cross-organization references.

Current API writes also perform explicit ownership checks before invoking transactional WMS functions. Unknown and foreign IDs return the same unavailable response so the API does not reveal whether another organization owns an object.

Seller records remain customers of a fulfillment organization rather than top-level tenants. `seller_members` narrows an authenticated client session to one seller. A seller owner may manage that seller's encrypted marketplace credential; a seller viewer has read-only access.

## Extension rules

- New writes use explicit actions in `lib/wms-contract.js` and `POST /api/ops` until a module warrants its own route.
- Marketplace code must depend on internal service contracts, never update inventory tables directly.
- Schema changes are versioned in `migrations/` and tested on a Neon branch.
- External events require idempotency keys.
- Logs may contain identifiers and timings, but never passwords, tokens or database URLs.
