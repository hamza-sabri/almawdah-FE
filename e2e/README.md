# End-to-end tests (Playwright)

Full-stack E2E against a **local, disposable** stack: a fresh SQLite backend
seeded with the `demo` tenant (login `demo`/`demo`, 40 known products) + the
Next.js app. Both servers boot automatically — one command runs everything.

## One-time setup

> This repo uses **pnpm** (there is a `pnpm-lock.yaml`). Use `pnpm`, not `npm`.

```bash
cd al-rahmah-store-admin
pnpm install                     # picks up @playwright/test
pnpm exec playwright install chromium # browser binaries
# backend venv must have Django deps (it already does for dev):
#   cd ../alrahmah && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Assumes the backend repo is a sibling at `../alrahmah`. Otherwise:
`BACKEND_DIR=/path/to/alrahmah npm run test:e2e`.

## Run

```bash
pnpm test:e2e          # headless, boots backend+frontend, runs all specs
pnpm test:e2e:ui       # interactive UI mode (great for writing new tests)
pnpm test:e2e:report   # open the HTML report after a run
```

The backend recreates `e2e/.e2e-db.sqlite3` and re-seeds on every run, so tests
always start from the same known state. It **never** touches a real database.

## What's covered now (the foundation)

- **auth.spec.ts** — wrong password rejected, valid login reaches the app,
  logged-out users are redirected from protected pages.
- **smoke.spec.ts** — every authenticated page (POS, products, stats, sales,
  debts, customers, purchases, reports, import, settings, guide) loads with **no
  server error, no uncaught JS error, no error-boundary**, plus the public
  `/price` kiosk. This alone catches "white screen" regressions app-wide.
- **pos.spec.ts** — the money path: add a product, complete a cash sale.

## Coverage roadmap — expand until nothing is left

Add one spec file per area. Each ✅ = a test to write; group happy-path + edge
cases. (Confirm exact selectors on the first `--ui` run, then lock them in.)

### POS (`pos.spec.ts`)
- ✅ cash sale (done) · ✅ credit/debt sale → pick customer → creates a debt
- ✅ scan a barcode adds the item · ✅ unknown barcode → prompt / no crash
- ✅ change quantity (+ / − / ¼ ⅓ ½) updates total · ✅ remove line · ✅ clear cart
- ✅ discount applied · ✅ sell below stock / zero-stock behaviour
- ✅ multi-cart (tables) switch · ✅ receipt/print dialog opens · ✅ return flow

### Inventory (`products.spec.ts`)
- ✅ list loads + search by name/barcode · ✅ sort columns · ✅ pagination/scroll
- ✅ add product (validation errors, then success) · ✅ edit product · ✅ delete (owner)
- ✅ expiry badges + `?expiry=` filters · ✅ stats page KPIs · ✅ bulk-delete guard

### Sales / Debts / Customers
- ✅ sales list, filters, reprint, CSV · ✅ owner bulk-delete (reverses stock)
- ✅ debts list + per-customer statement + record payment · ✅ debts stats
- ✅ customers CRUD + detail page (their debts/history)

### Purchases · Reports · Import · Settings · Price kiosk · Guide
- ✅ purchases: restock quota → generate PO → receive → history
- ✅ reports: each tab, KPI filter cards, charts reflect filter, click-to-edit
      modal (flagged field highlighted), multi-sheet xlsx download
- ✅ import: dry-run shows coverage %, warnings non-blocking, commit is atomic
- ✅ settings: staff mgmt (owner), branding upload, sync modes, theme
- ✅ `/price`: scan → product profile (price, gallery), favourites/history
- ✅ guide: interactive tour runs start→finish without logging the user out
- ✅ locked-module dialog · ✅ RTL layout on key pages · ✅ mobile viewport (POS, nav)

### Cross-cutting
- ✅ tenant isolation smoke (a second seeded store can't see the first's ids)
- ✅ offline: catalog cache is per-store; a stale/foreign id never checks out
- ✅ 404 / unknown route · ✅ session expiry → redirect to login

## CI

Add a job that runs `npm run test:e2e` (Playwright installs browsers; the
backend runs on SQLite). `reuseExistingServer` is off in CI so it always boots
clean.
