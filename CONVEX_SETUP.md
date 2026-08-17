# Realtime cart sync (Convex) — one-time setup

The POS carts sync live across devices through [Convex](https://www.convex.dev):
scan an item on the phone and it appears on the desktop cart instantly, no
refresh. The Convex code lives in `convex/` (schema + `carts.get`/`carts.put`).

Without Convex configured the app keeps working exactly as before (carts sync
on page load via the Django API) — the realtime layer is purely additive.

## Setup (run on your machine, in this repo)

1. Install deps (convex was added to package.json):

   ```sh
   pnpm install
   ```

2. Create the Convex project and push the functions (opens the browser to
   log in / sign up on the free plan; creates `.env.local` with
   `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` automatically):

   ```sh
   npx convex dev
   ```

   Leave it running while developing — it live-reloads the `convex/` folder.
   Ctrl-C once it says the functions are deployed if you just want the setup.

3. Production: deploy the functions and point the app at the prod deployment:

   ```sh
   npx convex deploy
   ```

   Then in Dokploy add the env var to the frontend service and redeploy:

   ```
   NEXT_PUBLIC_CONVEX_URL=https://<your-prod-deployment>.convex.cloud
   ```

   (`npx convex deploy` prints the URL; it's also in the Convex dashboard.)

## How it works

- Every device subscribes to the account's single `cartStates` document; Convex
  pushes changes over a websocket (no polling, no Neon queries).
- Local edits broadcast after a 250 ms debounce; last write wins, and a
  `savedAt` timestamp guard stops stale snapshots or echoes from re-applying.
- Django/Postgres still stores the durable copy (debounced 1.5 s), so nothing
  is lost if Convex is unreachable.
- The account id comes from the JWT (`user_id`), so all devices logged into the
  same account share carts — which is exactly the demo scenario.

Note: for the demo this trusts the client-provided account id. Before selling
real multi-tenant accounts, wire Convex auth (it can validate the same JWTs)
so one account can't read another's carts.
