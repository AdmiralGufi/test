# Fulfillment WMS

Production: https://fulfillment-wms.vercel.app  
Repository: `AdmiralGufi/test` · branch `main`

## Project tree

```text
app/
├── page.js                       → components/WmsAppV3.js
├── layout.js
├── globals.css                   → desktop/mobile responsive UI
└── api/
    ├── bootstrap/route.js        → initial state, user and WMS data
    ├── auth/
    │   ├── setup/route.js        → first administrator
    │   ├── login/route.js        → login and session
    │   └── logout/route.js
    ├── ops/route.js              → transactional WMS commands
    ├── scan/route.js             → BOX / SKU / cell / order lookup
    └── status/route.js           → setup and session status
components/
└── WmsAppV3.js                   → operational UI, ZXing camera, TSD Enter
lib/
├── db.js                         → lazy server-only Neon connection
├── auth.js                       → secure HTTP-only sessions
└── rbac.js                       → role permissions
```

## Operational tree

```text
First run
└── CREATE ADMIN
    └── Login
        ├── Receiving
        │   ├── CREATE_SELLER
        │   ├── CREATE_PRODUCT
        │   ├── CREATE_BOX
        │   └── ADD_BOX_ITEM
        ├── Warehouse
        │   ├── MOVE_BOX → zone
        │   └── MOVE_BOX → cell
        ├── Orders
        │   ├── CREATE_ORDER → inventory reservation
        │   ├── PICK_ITEM → transactional inventory deduction
        │   ├── ORDER_PACKED
        │   ├── ORDER_READY
        │   └── ORDER_SHIPPED
        ├── Staff
        │   └── CREATE_USER
        └── Devices
            ├── REGISTER_DEVICE (PHONE)
            └── REGISTER_DEVICE (TSD)
```

## Data tree

```text
Neon: long-queen-60642599 / br-lucky-moon-axa4is5f / neondb
├── zones ── cells
├── sellers ── products
├── receipts ── boxes ── box_items ── inventory
├── orders ── order_items ── order_allocations
├── users ── sessions
├── devices ── scan_events
└── audit_logs
```

`DATABASE_URL` is configured only as a Sensitive Vercel environment variable. It is never exposed through `NEXT_PUBLIC_*` and is not committed.
