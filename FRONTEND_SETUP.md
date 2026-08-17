# AL-Rahmah Store — frontend (Next.js)

Arabic (RTL), mobile-first admin for the deployed backend at
**https://alrahmah.clinixa.cloud**. Built with Next.js (App Router) + shadcn/ui
(Midnight Bloom theme, base-ui) + TanStack Query + an **orval**-generated API
client + **GSAP** animations + Recharts.

## Run it

Requires Node 20+. Use **pnpm** (recommended — the lockfile is pnpm and React 19
peer deps are cleaner):

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

With npm instead: `npm install --legacy-peer-deps && npm run dev`.

The API base URL defaults to the deployed backend, so it works out of the box.
To point elsewhere, create `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=https://alrahmah.clinixa.cloud
```

**Login** with the store admin account you created on the backend
(`createsuperuser` / `bootstrap.sh`). There is no signup — accounts are staff-only.

## What's built

- `/login` — JWT login (no signup). All app routes are guarded; 401s auto-refresh.
- `/` — **Dashboard**: stat cards (GSAP count-up) + charts (outstanding by month,
  top debtors, paid vs unpaid, customers by gender).
- `/products` — searchable/sortable list (infinite scroll over ~21k rows),
  add/edit (image via URL **or** upload), delete.
- `/customers` — search + gender/status filters, add/edit (gender radio, default
  male; avatar via URL or upload), delete.
- `/customers/[id]` — profile + outstanding + that customer's debts, with add-debt.
- `/debts` — paid/unpaid tabs + search; create/edit a debt from product line
  items (server-search combobox, live total, optional discount, mark paid).

## Regenerating the API client

The typed client + hooks under `api/generated/` come from the backend's OpenAPI
schema via orval. After any backend model change, refresh it:

```bash
pnpm api            # runs orval against https://alrahmah.clinixa.cloud/api/schema/
```

(The `gender` field is already included.)

## Deploy

Vercel (or any Node host): set `NEXT_PUBLIC_API_BASE_URL`, then `pnpm build`.
After the frontend has a URL, **lock down CORS on the backend**: set
`CORS_ALLOW_ALL_ORIGINS=False` and `CORS_ALLOWED_ORIGINS=https://<frontend-domain>`
in Dokploy (it's currently permissive for development).

## Notes

- Images use plain `<img>` (avatars/med photos are external/B2 URLs), so no
  `next/image` domain config is needed.
- I couldn't run a full `pnpm install`/typecheck in the build environment, so run
  `pnpm build` once locally to surface any last type nits — the code targets the
  generated client and the project's base-ui component APIs.
