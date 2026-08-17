/*
 * Pharma POS service worker — offline app shell.
 *
 * Goal: the POS keeps loading when Qalqilya's internet/power blips. We cache
 * the Next.js app shell + static assets so a reload works offline; the sale
 * data itself is handled in the app (IndexedDB catalogue cache + offline sale
 * queue). We NEVER cache API writes.
 *
 * Strategies:
 *   - navigations  → network-first, fall back to the cached page (or "/")
 *   - static (_next/static, icons, fonts, images) → stale-while-revalidate
 *   - cross-origin (Django API, Convex, analytics) → left untouched
 *   - non-GET (POST/PUT sales, cart-state) → never intercepted
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

const NAV_CACHE = `pharma-nav-${VERSION}`
const STATIC_CACHE = `pharma-static-${VERSION}`
const KEEP = new Set([NAV_CACHE, STATIC_CACHE])

const PRECACHE_ROUTES = ["/login", "/pos", "/price", "/debts", "/customers"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(NAV_CACHE)
      await Promise.allSettled(
        PRECACHE_ROUTES.map(async (route) => {
          try {
            const res = await fetch(route, { credentials: "same-origin" })
            if (res.ok) await cache.put(route, res.clone())
          } catch {
            return
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
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
          const cache = await caches.open(NAV_CACHE)
          cache.put(req, fresh.clone())
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
