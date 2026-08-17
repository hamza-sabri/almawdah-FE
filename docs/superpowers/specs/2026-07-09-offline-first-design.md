# Offline-first store — design spec (2026-07-09)

Make the store app operate **completely offline**, indistinguishable from
online: every page reads, every action writes, and work syncs both ways when the
internet returns (which may be only an hour or two a day). Offline is sold as
**granular paid capabilities**, works across **several devices** at once, and
handles **login / user-switching with no network**.

## Decisions (agreed)
- **Offline auth:** per-user **PIN switching** (the standard shared-POS pattern — Square/Toast/Clover) on top of session persistence, with a **device-local password verifier** as the first-device fallback. No password or PIN hashes are shipped from the server; enrollment is **per device** (a user logs in online on a terminal once → that terminal can then authenticate/switch them offline).
- **Sync model:** additive data (sales, debts, payments, returns, stock moves) is an **append-only operation log** merged by **union + idempotency keys** (no conflicts, any number of devices); the few editable records use **field-level Last-Write-Wins** by server `updated_at`. Two-way: push the local op-log + pull a server delta on reconnect. **Fully automatic, no user decision** — a passive status pill plus a rare "couldn't sync (N)" exceptions tray for genuine hard failures only.
- **Packaging:** offline is gated per capability via the existing `Store.enabled_modules` + `ModuleEnabled` system — new keys `offline_pos`, `offline_debts`, `offline_inventory`, `offline_customers`. The app enables the local mirror + write queue per enabled capability.
- **Multi-device:** several devices may be offline simultaneously; the op-log union + idempotency + natural-key dedup (customer phone) makes their work merge safely.

## Where we start (current state)
One `customFetch` mutator centralizes offline behavior. Today, offline is a thin
veneer behind the single `offline` module: POS sell (cash+debt) works, Sales
list/stats + `/me` are cached/queue-merged, sales are queued with `client_uuid`
idempotency and synced on reconnect. **Everything else breaks offline** — Debts,
Debt stats/Dashboard, Customers reads have no local answer; and **all writes
except sale-create** (debt/customer/med create·edit·delete, settlements, void/
returns) POST directly and throw. IndexedDB `pharma_offline_v1` holds the POS
catalog + a `pending_sales` queue. This spec generalizes that veneer into a real
local-first layer.

## Architecture

### 1. Local mirror (IndexedDB)
A per-tenant mirror of the data each enabled capability needs: `products`,
`categories`, `customers`, `debts`, `debt_items`, `sales`, `sale_items`. One
object store per entity keyed by id, plus a `meta` store (`last_synced_at`,
schema version) and the existing op-queue store. Seeded on login (full pull),
then kept fresh by delta pulls. Reuse the existing hand-rolled IDB wrapper,
bumped to a new version with the added stores.

### 2. Reads — always answerable locally
Generalize `lib/offline/reads.ts` into a small **local query layer** that can
compute every screen from the mirror: Debts list (+filters/paging), Debt stats /
Dashboard (`/debts/dashboard/`), Customers list + detail, Product stats — the
same way Sales list/stats already merge cached data with the queue. Offline (or
on network error) these return local results instead of throwing. Online stays
network-first with write-through into the mirror.

### 3. Writes — optimistic + op-log
Route every mutation (`lib/mutate.ts` upsert/remove, `customerSettle`, debt
payments, sale void/return, sale create) through one **operation queue**:
1. Assign a client op id + idempotency key; for creates, a **temporary local id** (UUID/negative).
2. **Apply optimistically** to the mirror so the UI updates instantly.
3. Enqueue the operation `{type, entity, idempotencyKey, tempId?, payload, deps[], createdAt, deviceId}`.
The UI reads the mirror, so queued work is visibly "there" offline.

### 4. Sync engine
On reconnect / focus / interval (extend `use-offline-sync`):
- **Push** the op-log oldest-first. Each op carries an idempotency key so a
  retried op never double-applies. **Dependency ordering + temp-id remap:** a
  debt that references an offline-created customer waits for the customer op,
  captures its server id, and rewrites the reference before sending. A
  **remap table** (tempId → serverId) is applied to all later ops. Customers
  dedup by natural key (phone) server-side so two devices creating the same
  customer converge to one id.
- **Pull** a server **changes delta** (`?since=last_synced_at`, incl. tombstones
  for deletes) and merge into the mirror with **field-level LWW** on `updated_at`.
- Hard failures (e.g. a debt whose customer was deleted server-side) move to a
  small **exceptions tray**; everything else is silent.

### 5. Offline auth
- **Online login** on a device enrolls the user locally: cache their profile +
  modules + JWT pair, and — the first time — capture a **device-local verifier**
  = slow KDF (PBKDF2/Argon2 via WebCrypto) of the typed password, and prompt to
  set a **PIN** (also KDF-hashed locally, per-install salt). Nothing is sent to
  the server; verifiers/PINs never leave the device.
- **Offline login / switch:** a **user picker** (roster of enrolled users on this
  device) → enter **PIN** (or full password → verifier) → restore that user's
  cached session. Rate-limited attempts.
- **Reconnect:** the (possibly expired) access token is renewed via the 30-day
  refresh token; queued work syncs. `isAuthenticated()` already keeps a
  logged-in user working offline — this only adds the switch/fresh-login path.
- A user never enrolled on this device can't authenticate offline (one online
  login fixes it) — surfaced clearly.

### 6. Backend support
- **Idempotency + upsert-by-uuid** on debts, customers, products, payments/
  settlements, and sale void/return — mirror the existing `Sale.client_uuid`
  pattern (nullable `client_uuid` + unique-per-tenant + get-or-return-original on
  replay). Migration per entity.
- **Changes/delta endpoint** (`/sync/changes/?since=`): rows changed since a
  cursor across the tenant's entities, plus **tombstones** for deletions
  (soft-delete or a deletions log) so pulls can remove locally.
- **Customer dedup** by `(store, phone)` on create so multi-device offline
  creates converge.
- **Offline module keys** (`offline_pos`, `offline_debts`, `offline_inventory`,
  `offline_customers`) added to `apps.store.modules.MODULES`; returned in
  `/auth/me` modules so the frontend gates per capability.
- (PIN/verifier are device-local — **no** server credential storage in the
  default design.)

## Conflict policy (summary, no user decisions)
- Additive entities → op-log union + idempotency → **no conflicts by construction**, even across devices.
- Editable records → **field-level LWW** by `updated_at` → automatic.
- Genuine unresolvable ops → **exceptions tray** (rare), never a routine prompt.

## Phasing (each phase independently deployable)
- **Phase 0 — backend foundations:** idempotency/upsert on all write entities, the changes/delta endpoint + tombstones, customer dedup, offline module keys. Tests. Migrations (gated).
- **Phase 1 — local mirror + all reads offline:** IDB stores + full/delta seed; local query layer so Debts, Debt stats/Dashboard, Customers read offline. (Fixes today's debt-page failure first.)
- **Phase 2 — generic write queue + sync engine:** optimistic writes → mirror + op-log; push replay with temp-id remap + dependency order + idempotency; pull delta + LWW merge; exceptions tray.
- **Phase 3 — offline auth:** PIN enrollment + device-local verifier; offline user-picker + PIN switch; password fallback; reconnect refresh.
- **Phase 4 — granular gating + polish:** per-capability module gating, status UI, PWA install/update, multi-device test matrix.

## Out of scope / risks
- Not building CRDTs; LWW is intentional and sufficient for a single tenant's staff.
- Same-field edits on two devices lose the older edit (acceptable, rare, silent).
- A stolen enrolled device exposes that device's cached sessions (PIN ≈ device physical security — standard POS assumption).
- Refresh token expiry after 30 days offline forces an online re-login (edge case).

## Verification
Per phase: unit tests for the sync engine (temp-id remap, dependency order,
idempotent replay, LWW merge, tombstone deletes); backend tests for idempotent
upserts + delta + dedup; an end-to-end **airplane-mode drill** — go offline,
do sales + a debt to a new customer + a settlement across two simulated devices,
reconnect, and assert the server converges with no duplicates and no lost work.
