# Database migrations

Migrations are ordered, immutable records of production schema changes.

Rules:

1. Never edit a migration after it has reached production.
2. Test every new migration on a temporary Neon branch cloned from production.
3. Verify existing data, constraints and the complete application flow before applying it.
4. Apply application compatibility changes before a breaking or required-column migration.
5. Record the Neon migration ID and production verification result in the pull request or release notes.

Applied migrations:

- `001_organizations.sql` — organizations, warehouses, memberships and session/company context. Neon migration `13a6bbd8-5668-41e6-8ed0-4ab0f85726f0`.
- `002_platform_admin.sql` — platform owner permission. Neon migration `1b013254-91f8-4b48-bceb-04697a0eda9d`.
- `003_zone_scope.sql` — warehouse-scoped standard zone codes. Neon migration `b7fdb5ab-ac3b-4137-a719-08c4c3d9c502`.
- `004_wildberries_integration.sql` — encrypted WB credentials, product identifiers and idempotent FBS imports. Neon migration `8864fca9-7edd-4903-8550-add845bf21e6`.
- `005_seller_portal.sql` — seller-scoped user access and warehouse location fields. Neon migration `937c9cb7-c778-4114-8bb7-f9f7e13da7ae`, verified on temporary branch and applied to production on 2026-08-13.
- `006_organization_archive.sql` — reversible fulfillment archive marker and lifecycle lookup index. Neon migration `348a49f4-0ec5-4907-acb0-41af5b3a51dc`, verified on a temporary branch and applied to production on 2026-08-13.
- `007_commercial_scale.sql` — plan/trial lifecycle and warehouse routing for orders and WB integrations. Neon migration `bba63f1f-d5d8-47be-98d0-94ac1ab52de4`, verified on a temporary branch and applied to production on 2026-08-13.
- `008_wb_shipping_routes.sql` — WB destination data and a ready-order route index for the fulfillment shipping desk. Neon migration `b9415082-e39d-4ea6-be7e-300df05fe380`, verified on a temporary branch and applied to production on 2026-08-13.
