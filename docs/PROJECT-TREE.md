# Repository tree

```text
fulfillment-wms/
├── app/
│   ├── api/
│   │   ├── auth/           # setup, login and logout
│   │   ├── bootstrap/      # authenticated application snapshot
│   │   ├── cron/           # protected background marketplace sync
│   │   ├── integrations/   # Wildberries and future marketplaces
│   │   ├── ops/            # canonical transactional operations
│   │   ├── platform/       # platform-owner organization onboarding
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
│   ├── db.js               # server-only Neon client and transactions
│   ├── observability.js    # structured runtime logging
│   ├── rbac.js             # roles and access rules
│   ├── secrets.js          # server-side token encryption
│   ├── wildberries.js      # WB FBS adapter and idempotent importer
│   └── wms-contract.js     # public operation contract
├── migrations/             # reviewed, ordered Neon schema changes
├── public/                 # icons, service worker and offline page
├── tests/                  # contract and architecture checks
├── .github/workflows/      # CI quality gate and 5-minute WB sync
└── package.json
```

Production data is never used as a development sandbox; migration tests run on temporary Neon branches.
