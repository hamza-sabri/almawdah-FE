import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

/**
 * The offline app shell only covers routes public/sw.js precaches at install.
 *
 * This is not a style rule. With the App Router, moving between pages in the
 * running app is an RSC fetch, not a navigation — so browsing online never
 * fills the service worker's navigation cache. A route that isn't precached
 * shows the "لا يوجد اتصال" fallback the moment the user reloads on it with no
 * network, even though every byte of its data is already in IndexedDB. That is
 * the bug that shipped: /pos was precached, /inventory was not.
 *
 * So: every page under app/(app)/ must appear in PRECACHE_ROUTES.
 */

const ROOT = path.resolve(__dirname, "../..")

/**
 * Pages that exist on disk but are deliberately unreachable, so there is no
 * point spending install-time bandwidth on them. Anything added here needs a
 * reason.
 *   /guide — the tutorial, pulled from the nav for this store.
 */
const NOT_LINKED = new Set(["/guide"])

function appRoutes(): string[] {
  const base = path.join(ROOT, "app", "(app)")
  const found: string[] = []
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      // Dynamic segments ([id]) have no single URL to precache.
      if (entry.startsWith("[")) continue
      const href = `${prefix}/${entry}`
      try {
        statSync(path.join(full, "page.tsx"))
        found.push(href)
      } catch {
        /* a layout-only or grouping folder */
      }
      walk(full, href)
    }
  }
  walk(base, "")
  return found.sort()
}

function precachedRoutes(): string[] {
  const sw = readFileSync(path.join(ROOT, "public", "sw.js"), "utf8")
  const block = sw.match(/const PRECACHE_ROUTES = \[([\s\S]*?)\]/)
  if (!block) throw new Error("PRECACHE_ROUTES not found in public/sw.js")
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()
}

describe("the service worker precaches the whole app shell", () => {
  it("covers every page under app/(app)/", () => {
    const missing = appRoutes().filter(
      (r) => !NOT_LINKED.has(r) && !precachedRoutes().includes(r),
    )
    expect(missing, `not precached in public/sw.js: ${missing.join(", ")}`).toEqual(
      [],
    )
  })

  it("includes /login, so a logged-out reload offline still renders", () => {
    expect(precachedRoutes()).toContain("/login")
  })

  it("warms the build's JS chunks, not just the HTML", () => {
    // A cached document without its /_next/static chunks renders and then dies
    // on the first failed <script>. The install step reads the chunk URLs back
    // out of the HTML it just fetched.
    const sw = readFileSync(path.join(ROOT, "public", "sw.js"), "utf8")
    expect(sw).toMatch(/\/_next\\\/static/)
    expect(sw).toContain("warmAssetsFrom")
  })

  it("never replays RSC payloads from cache", () => {
    // A stale RSC payload renders a broken tree; failing lets Next hard-navigate
    // to the cached HTML instead.
    const sw = readFileSync(path.join(ROOT, "public", "sw.js"), "utf8")
    expect(sw).toMatch(/searchParams\.has\("_rsc"\)/)
  })
})
