# Design: central homepage + per-store apps on one backend (2026-07-08)

Approved by Hamza. Full living reference: `../../../MULTI_DOMAIN_ARCHITECTURE.md`.

## Goal
`pharma.clinixa.cloud` becomes the marketing homepage + login for the "Pharma"
product. Store subdomains (`<slug>.clinixa.cloud`) skip the homepage and serve
that tenant's app. One shared backend, moved to `api.clinixa.cloud`.

## Decisions
- Two build-time site modes via `NEXT_PUBLIC_SITE_MODE` (`central` | `store`).
- Central login authenticates then hands the JWT pair to the user's store
  subdomain via a URL **fragment** (localStorage is per-origin). `AuthGuard`
  consumes and strips it. Accepted tradeoff: refresh token briefly in the
  fragment; revisit with a `.clinixa.cloud` cookie later.
- Backend already returns `store_slug` (login + `/auth/me/`) — no backend code
  change, no migration.
- Slug → subdomain by convention `<slug>.clinixa.cloud`.
- Git: `main` = central; per-store branches track their own; changes merged
  into all.

## Frontend changes
`lib/site.ts`, `lib/handoff.ts` (new); `app/page.tsx`, `app/login/page.tsx`,
`components/auth-guard.tsx`, `lib/auth.ts` (edited). See the architecture doc for
the file-by-file table and env matrix.

## Infra cutover (gated)
1. DNS `api.clinixa.cloud` → 76.13.1.139.
2. Backend: add `api.clinixa.cloud` domain, extend ALLOWED_HOSTS/CSRF, deploy
   (backend dual-homed on pharma + api).
3. Repoint both store frontends' API base → api.clinixa.cloud, add SITE_MODE +
   ROOT_DOMAIN, redeploy.
4. Move `pharma.clinixa.cloud` off backend; create Central Dokploy service
   (tracks main), attach the domain, deploy.
