# Delivery roadmap

## Phase 0 — production foundation

- [x] Transactional inventory and outbound operations
- [x] Roles, authentication and audit trail
- [x] Mobile PWA, camera and HID/Enter scanning
- [x] GitHub CI and stable Vercel domain
- [x] GitHub-to-Vercel deployment connection
- [x] Health endpoint and structured error baseline
- [ ] End-to-end browser tests in CI
- [ ] Error tracking and alerting

## Now — commercial scale foundation

- [x] Organization and warehouse foundation
- [x] Organization ownership checks for every current write action
- [x] Organization-scoped authorization tests
- [x] Guided platform-owner company setup
- [x] Fulfillment access, plan, administrator and archive management
- [x] Seller portal with scoped warehouse stock, FBS orders and WB access
- [x] Plan catalog with enforced warehouse, user, client and monthly-order limits
- [x] Fourteen-day trial lifecycle and automatic access suspension after expiry
- [x] Multiple warehouses with automatic operational-zone setup
- [x] Warehouse routing for receiving, manual orders and Wildberries imports
- [ ] CSV/XLSX import and export
- [ ] Label printing
- [ ] Operational KPI dashboard

## Next — operator productivity and integrations

- [x] Wildberries credentials vault and connection flow
- [x] Automatic, idempotent Wildberries FBS order synchronization
- [x] WB product matching by chrtId, barcode and internal fallback SKU
- [ ] Idempotent webhook/event inbox
- [ ] Retry queue and integration monitoring
- [ ] Public API keys and webhooks
- [ ] Returns, replenishment and wave picking

## Later — commercial expansion

- [ ] Automated payment provider and invoices
- [ ] White-label configuration
- [ ] Native mobile shells and advanced offline conflict resolution
- [ ] Optional 3D warehouse visualization

The plan limits are configurable product defaults. Automatic card charging requires a payment-provider account and production credentials; until connected, activation is controlled by the platform owner.

Every phase must preserve a green `npm run check`, pass a production smoke test and include a rollback path for database changes.
