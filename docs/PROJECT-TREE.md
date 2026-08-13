# Repository tree

```text
fulfillment-wms/
├── app/
│   ├── api/
│   │   ├── auth/           # setup, login and logout
│   │   ├── bootstrap/      # authenticated application snapshot
│   │   ├── ops/            # canonical transactional operations
│   │   ├── scan/           # box/SKU/cell/order lookup
│   │   └── status/         # production readiness probe
│   ├── error.js            # recoverable UI failure state
│   ├── globals.css         # design system and responsive layout
│   ├── layout.js           # metadata and PWA configuration
│   ├── manifest.js         # installable app manifest
│   └── page.js             # WMS entry point
├── components/
│   ├── PwaInstall.js       # installation and service worker
│   └── WmsAppV3.js         # current operational UI
├── docs/                   # product and engineering decisions
├── lib/
│   ├── auth.js             # secure sessions
│   ├── db.js               # server-only Neon client
│   ├── observability.js    # structured runtime logging
│   ├── rbac.js             # roles and access rules
│   └── wms-contract.js     # public operation contract
├── public/                 # icons, service worker and offline page
├── tests/                  # contract and architecture checks
├── .github/workflows/      # repeatable quality gate
└── package.json
```

Database migrations will live in `migrations/` after the first schema baseline is exported. Production data is never used as a development sandbox; migration tests run on Neon branches.
