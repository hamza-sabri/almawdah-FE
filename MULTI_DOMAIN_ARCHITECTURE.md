# Multi-domain architecture: central homepage + per-store apps

_Last updated 2026-07-08. This is the frontend side of the "Pharma" multi-tenant
rollout. Backend and infra IDs live in `../PHARMA_ROLLOUT_RESUME.md`._

## The model

One Next.js app, built once per **site mode**, deployed to several domains that
share **one backend**.

| Domain | Mode | `NEXT_PUBLIC_SITE_MODE` | `NEXT_PUBLIC_PHARMACY_SLUG` | Shows |
| --- | --- | --- | --- | --- |
| `pharma.clinixa.cloud` | central | `central` | _(unset)_ | Marketing homepage + login + guest demo |
| `alrahmah.clinixa.cloud` | store | `store` | `alrahmah` | Login → the store app (POS, sales…) |
| `alhiah.clinixa.cloud` | store | `store` | `alhiah` | same, for the alhiah tenant |

The backend is at `api.clinixa.cloud` (all three frontends set
`NEXT_PUBLIC_API_BASE_URL=https://api.clinixa.cloud`). Convex is shared.

### Central site (`pharma.clinixa.cloud`)
- `/` renders the marketing `<Landing>` (laptop/mobile mockups, prices, features).
- The guest "جرّب بدون تسجيل" demo runs here on the in-browser mock (no backend).
- `/login` authenticates, then **hands the session off to the user's store
  subdomain** and lands them on `/pos` there (see handoff below). The central
  origin keeps **no** session — tokens are cleared right after the handoff URL is built.

### Store site (`<slug>.clinixa.cloud`)
- `/` immediately `redirect("/login")` — the marketing homepage is never shown to
  a store's staff. (The store's public **storefront** will slot in at `/`
  later; not built yet.)
- `/login` → `/pos` on the same origin (normal localStorage session).
- Already-authenticated staff hitting `/login` are bounced straight to `/pos`.

## Cross-subdomain login handoff (why it exists)

Auth is a JWT pair (access + refresh) kept in **`localStorage`**, which is
**per-origin**. A login completed on `pharma.clinixa.cloud` therefore can't be
read by `alrahmah.clinixa.cloud`. So the central login passes the tokens across
in the **URL fragment**:

```
https://<slug>.clinixa.cloud/pos#hnd=1&at=<access>&rt=<refresh>
```

- The fragment (`#…`) is **never sent to the server** or logged.
- `AuthGuard` calls `consumeHandoff()` first thing: it reads the fragment, stores
  the tokens, then `history.replaceState` strips the hash — so the URL is clean
  and the user is authenticated with no visible flash.

**Tradeoff (accepted for this stage):** the refresh token transits briefly in the
URL fragment. It's stripped immediately and only travels over HTTPS. If we later
want to remove even that exposure, switch to a cookie scoped to `.clinixa.cloud`
(shared across subdomains) — that needs backend cookie-auth + CSRF changes and is
tracked as a future option, not done here.

The backend already returns `store_slug` on both `/auth/login/` and
`/auth/me/` (`apps/accounts/serializers.py`), so the central login knows where to
send each user. No backend code change was needed.

## Files (frontend)

| File | Role |
| --- | --- |
| `lib/site.ts` | `isCentral()`, `getPharmacySlug()`, `pharmacyHost(slug)`, `pharmacyPosUrl(slug, tokens)`. Reads `NEXT_PUBLIC_SITE_MODE` + `NEXT_PUBLIC_ROOT_DOMAIN`. |
| `lib/handoff.ts` | `consumeHandoff()` — parse `#hnd` fragment, store tokens, strip hash. |
| `app/page.tsx` | Central → `<Landing>`; store → `redirect("/login")`. |
| `app/login/page.tsx` | Central → build handoff URL + `window.location.assign`; store → `router.replace(next)`. Redirects authed store staff to `/pos`. |
| `components/auth-guard.tsx` | Calls `consumeHandoff()` before the auth check. |
| `lib/auth.ts` | `login()` returns `SessionUser` (`User & { store_slug?, pharmacy_name? }`). |

## Build-time env (set in each Dokploy service's Build Args)

Central service:
```
NEXT_PUBLIC_SITE_MODE=central
NEXT_PUBLIC_API_BASE_URL=https://api.clinixa.cloud
NEXT_PUBLIC_CONVEX_URL=https://majestic-egret-857.convex.cloud
NEXT_PUBLIC_ROOT_DOMAIN=clinixa.cloud
```

Store services (alrahmah / alhiah):
```
NEXT_PUBLIC_SITE_MODE=store
NEXT_PUBLIC_PHARMACY_SLUG=<alrahmah|alhiah>
NEXT_PUBLIC_API_BASE_URL=https://api.clinixa.cloud
NEXT_PUBLIC_CONVEX_URL=https://majestic-egret-857.convex.cloud
NEXT_PUBLIC_ROOT_DOMAIN=clinixa.cloud
```

Because `NEXT_PUBLIC_*` is baked at build, changing any of these requires a
**redeploy** of that service.

## Git branch model

- `main` = the central ("pharma") build. The Central Dokploy service tracks `main`.
- `alhiah`, `alrahmah` branches per store; each store service tracks its branch.
- These routing/handoff changes were made on `main` and merged into both store
  branches so every deployment has the mode logic + handoff receiver.

## Doing UI work on the central homepage

The marketing homepage is `<Landing>` in `components/marketing/landing.tsx`,
rendered by `app/page.tsx` in central mode. Edit freely — the routing above is
independent of the visual content. To preview central mode locally:

```
NEXT_PUBLIC_SITE_MODE=central pnpm dev
```

To preview a store build locally:

```
NEXT_PUBLIC_SITE_MODE=store NEXT_PUBLIC_PHARMACY_SLUG=alrahmah pnpm dev
```

## Known edge cases / TODO

- A central account with **no** linked store shows an error toast on login
  ("لا توجد صيدلية مرتبطة بهذا الحساب") — there's no central-only app surface.
- Slug → subdomain is by **convention** (`<slug>.clinixa.cloud`); there's no host
  column on the `Store` model. Add one if a tenant ever needs a custom domain.
- Handoff refresh-token-in-fragment tradeoff (see above) — revisit with a
  `.clinixa.cloud` cookie if we harden auth.
