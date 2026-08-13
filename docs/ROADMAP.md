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

## Phase 1 — commercial pilot

- [x] Organization and warehouse foundation
- [x] Organization ownership checks for every current write action
- [ ] Organization-scoped authorization tests
- [ ] Guided first-run company setup
- [ ] Seller portal
- [ ] CSV/XLSX import and export
- [ ] Label printing
- [ ] Operational KPI dashboard

## Phase 2 — integrations

- [ ] Wildberries credentials vault and connection flow
- [ ] Products and orders synchronization
- [ ] Idempotent webhook/event inbox
- [ ] Retry queue and integration monitoring
- [ ] Public API keys and webhooks

## Phase 3 — commercial platform

- [ ] Plans, limits and trials
- [ ] Usage metering and billing
- [ ] White-label configuration
- [ ] Multiple warehouses
- [ ] Returns, replenishment and wave picking

Every phase must preserve a green `npm run check`, pass a production smoke test and include a rollback path for database changes.
