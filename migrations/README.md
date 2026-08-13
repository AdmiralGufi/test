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
