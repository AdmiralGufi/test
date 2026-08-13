# Fulfillment WMS

Production-oriented warehouse management system for FBS fulfillment operations. The current product covers receiving, address storage, inventory, picking, packing, shipping, handheld scanners and mobile PWA installation.

## Local development

Requirements: Node.js 22+ and a PostgreSQL/Neon connection string.

```bash
npm ci
DATABASE_URL="postgresql://..." npm run dev
```

`DATABASE_URL` is server-only. Never prefix it with `NEXT_PUBLIC_` and never commit it.

## Quality gate

```bash
npm run check
```

This runs contract tests and a production Next.js build. GitHub Actions runs the same gate for every push to `main` and every pull request.

## Application boundaries

- `app/` — UI entry points and HTTP routes
- `components/` — operator interfaces and PWA controls
- `lib/` — authentication, database access, roles, contracts and logging
- `public/` — PWA assets and offline shell
- `tests/` — executable contract checks
- `docs/` — product, architecture and delivery decisions

The canonical write endpoint is `POST /api/ops`. Legacy write endpoints intentionally return `410 Gone`.

## Deployment

`main` is connected to the Vercel project `fulfillment-wms`. Production uses the stable domain:

https://fulfillment-wms.vercel.app

Database schema changes must be tested on a temporary Neon branch before they are applied to production.

## Product documentation

- [Product requirements](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Repository tree](docs/PROJECT-TREE.md)
