/*
 * POS service worker — offline app shell.
 *
 * Goal: the app keeps loading when the shop's internet/power blips. We cache
 * the Next.js app shell + static assets so a reload works offline; the sale
 * data itself is handled in the app (IndexedDB catalogue cache + offline read
 * cache + offline sale queue). We NEVER cache API writes.
 *
 * Strategies:
 *   - navigations  → network-first, fall back to THIS route's cached page
 *   - RSC payloads (?_rsc=) → passed through; never cached (see below)
 *   - static (_next/static, icons, fonts, images) → stale-while-revalidate
 *   - cross-origin (Django API, analytics) → left untouched
 *   - non-GET (POST/PUT sales, cart-state) → never intercepted
 *
 * Why precache EVERY app route, not just "/pos": with the App Router, moving
 * between pages in the running app is an RSC fetch, not a navigation — so
 * browsing the app online never fills the navigation cache. Only a hard load
 * (typed URL, F5, or the installed PWA's start_url) does. That is exactly how
 * "/pos works offline but /inventory shows the offline page" happens: /pos was
 * precached at install, /inventory was never a navigation the worker saw.
 * Precaching the whole route list at install removes that dependency on where
 * the user happened to press reload.
 */

// Version every cache by the build id passed in the registration URL
// (/sw.js?v=<build>). A new deploy ⇒ new id ⇒ new cache names ⇒ the activate
// handler below deletes the previous version's caches. Fresh start every time.
const VERSION = (() => {
  try {
    return new URL(self.location.href).searchParams.get("v") || "v0"
  } catch {
    return "v0"
  }
})()

const NAV_CACHE = `pos-nav-${VERSION}`
const STATIC_CACHE = `pos-static-${VERSION}`
const KEEP = new Set([NAV_CACHE, STATIC_CACHE])

// Every page a user can land on: the nav rail's routes, plus /login and
// /price. lib/offline/sw-routes.test.ts fails if a page is added under
// app/(app)/ and not listed here.
const PRECACHE_ROUTES = [
  "/login",
  "/pos",
  "/inventory",
  "/inventory/stats",
  "/sales",
  "/purchases",
  "/reports",
  "/settings",
  "/customers",
  "/debts",
  "/debts/stats",
  "/price",
]

/**
 * A cached HTML shell is useless without the chunks it loads: offline the
 * document renders and then dies on a failed <script src="/_next/static/…">.
 * Next names those per build, so we can't hardcode them — we read them back
 * out of the HTML we just precached and warm them into the static cache.
 */
async function warmAssetsFrom(html, cache) {
  const urls = new Set()
  const re = /\/_next\/static\/[^"'\s>)]+/g
  let m
  while ((m = re.exec(html)) !== null) {
    // Strip HTML entities that can trail a URL inside an attribute.
    urls.add(m[0].replace(/&amp;/g, "&"))
  }
  await Promise.allSettled(
    [...urls].map(async (u) => {
      if (await cache.match(u)) return
      try {
        const res = await fetch(u, { credentials: "same-origin" })
        if (res.ok) await cache.put(u, res.clone())
      } catch {
        /* one missing chunk shouldn't fail the install */
      }
    }),
  )
}

// Without /pos cached there is no working POS offline, so it is the one route
// whose failure must abort the install.
const ESSENTIAL_ROUTE = "/pos"

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const nav = await caches.open(NAV_CACHE)
      const stat = await caches.open(STATIC_CACHE)
      await Promise.allSettled(
        PRECACHE_ROUTES.map(async (route) => {
          try {
            const res = await fetch(route, { credentials: "same-origin" })
            if (!res.ok) return
            await nav.put(route, res.clone())
            await warmAssetsFrom(await res.text(), stat)
          } catch {
            return
          }
        }),
      )
      // Every fetch above is allowSettled + try/catch, so the install would
      // otherwise "succeed" having downloaded nothing — and activate would
      // then delete the previous version's caches. Deploy day on a weak shop
      // connection would leave the till with NO offline shell at all, which
      // only shows up hours later when the internet actually drops.
      // Throwing here keeps the old worker (and its caches) in charge.
      if (!(await nav.match(ESSENTIAL_ROUTE))) {
        throw new Error("precache failed: /pos unavailable, keeping old worker")
      }
      // NO skipWaiting() here on purpose. Taking over immediately reloaded the
      // page the moment a deploy landed — potentially mid-sale, with a
      // customer at the counter. The new worker now waits until the cashier
      // taps "يوجد تحديث جديد" (components/offline/update-prompt.tsx), which
      // posts SKIP_WAITING below.
      //
      // First install is different: there is no controller to displace and
      // nothing on screen to interrupt, so take over at once.
      if (!self.registration.active) await self.skipWaiting()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Belt and braces: only bin the old caches once this version's shell is
      // demonstrably present.
      const nav = await caches.open(NAV_CACHE)
      if (await nav.match(ESSENTIAL_ROUTE)) {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)),
        )
      }
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname.startsWith("/brand") ||
    /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|ico|gif)$/.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  // Only manage our own origin — never the API, Convex realtime, or analytics.
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          // Only cache a real page. A 502/504 from Traefik mid-deploy, or a
          // Next 500, would otherwise become THIS route's offline copy — and
          // the till would serve an error page as the POS the next time the
          // internet dropped. `type === "basic"` also skips opaque redirects,
          // which cache.put rejects.
          if (fresh.ok && fresh.type === "basic") {
            const cache = await caches.open(NAV_CACHE)
            cache.put(req, fresh.clone()).catch(() => {})
          }
          return fresh
        } catch {
          // Offline: serve THIS route's cached HTML if we have it. Never fall
          // back to "/" — that flashed the marketing home before the real page.
          const cache = await caches.open(NAV_CACHE)
          return (
            (await cache.match(req)) ||
            (await cache.match(url.pathname)) ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>غير متصل</title><body style='font-family:sans-serif;direction:rtl;text-align:center;padding:3rem'>لا يوجد اتصال — أعد المحاولة عند عودة الشبكة.",
              { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
            )
          )
        }
      })(),
    )
    return
  }

  // App Router client-side navigation is an RSC fetch (`?_rsc=…`), not a
  // navigation. We deliberately do NOT serve those from cache: an RSC payload
  // is keyed to a router state tree, and replaying a stale one renders a
  // broken tree instead of failing cleanly. Left alone it fails offline, Next
  // falls back to a full navigation, and the branch above answers that from
  // the nav cache — which is why precaching every route above matters.
  if (url.searchParams.has("_rsc")) return

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => null)
        return cached || (await network) || Response.error()
      })(),
    )
  }
})
