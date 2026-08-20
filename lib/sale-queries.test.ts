import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { SALE_AFFECTED_KEYS } from "@/lib/sale-queries"

/**
 * One list of what a changed sale makes stale.
 *
 * Five places used to keep their own copy — the checkout, the void, the wipe,
 * the revision restore and the offline-sync flush — and they were only ever as
 * correct as whoever last remembered all five. Adding the day-summary cards
 * proved it at once: four were updated, one was not, and the owner rang up a
 * sale and watched the cards hold yesterday's number until he reloaded.
 *
 * A stale figure on a till is not cosmetic. It is the owner reading a total
 * that is quietly wrong with no reason to doubt it.
 */
const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe("the list itself", () => {
  it("includes the day-summary cards — the one that was missed", () => {
    expect(SALE_AFFECTED_KEYS).toContainEqual(["sales-day-summary"])
  })

  it("includes everything a sale moves", () => {
    for (const key of [
      "products",
      "pos-catalog",
      "sales",
      "sales-stats",
      "debts",
      "dashboard-stats",
      "customers",
      "customers-quick",
    ]) {
      expect(SALE_AFFECTED_KEYS).toContainEqual([key])
    }
  })
})

describe("nobody keeps a private copy of it", () => {
  it("no file invalidates sales-stats by hand", () => {
    // That was the tell-tale of a hand-kept list: if a file names this key
    // itself, it has its own idea of what else needs refreshing.
    const offenders = walk(join(ROOT, "app"))
      .concat(walk(join(ROOT, "components")), walk(join(ROOT, "hooks")))
      .filter((f) => {
        const code = readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
        return /invalidateQueries\(\{\s*queryKey:\s*\["sales-stats"\]/.test(code)
      })
    expect(offenders.map((f) => f.replace(ROOT + "/", ""))).toEqual([])
  })

  it("every write path calls the shared helper", () => {
    for (const f of [
      "app/(app)/pos/page.tsx",
      "app/(app)/sales/page.tsx",
      "components/sales/sale-revisions.tsx",
    ]) {
      expect(readFileSync(join(ROOT, f), "utf8")).toContain("invalidateSaleData(qc)")
    }
  })

  it("the offline flush shares it too", () => {
    const src = readFileSync(join(ROOT, "hooks/use-offline-sync.ts"), "utf8")
    expect(src).toContain("const AFFECTED_KEYS = SALE_AFFECTED_KEYS")
  })
})
