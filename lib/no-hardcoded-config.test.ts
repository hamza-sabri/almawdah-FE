import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * NOTHING that identifies a deployment may be hardcoded. Anywhere.
 *
 * Every store is its own deployment: its own database, its own Convex, its own
 * Sentry project, its own domain. A value that says WHICH store this is has
 * exactly one legitimate source — this deployment's environment.
 *
 * Two real incidents, same root cause:
 *
 *   NEXT_PUBLIC_CONVEX_URL defaulted to one shared Convex deployment in the
 *   Dockerfile. A Dockerfile ARG default applies precisely when the platform
 *   does NOT pass that argument, so every store built from the image joined
 *   the same realtime database, keyed by an account id that is only unique
 *   inside one store's own database. Two shops' tills showed each other's
 *   open baskets, live.
 *
 *   NEXT_PUBLIC_API_BASE_URL had per-file fallbacks to `alrahmah…` and
 *   `api.clinixa.cloud`. One missing build argument and this shop's cashier
 *   would have been reading and writing another shop's products, sales and
 *   debts — with nothing on screen to say so.
 *
 * A default is not a safety net. It is a silent substitution. Missing config
 * must fail visibly instead of borrowing a neighbour's.
 */

const ROOT = process.cwd()

/** Values that name ONE deployment. None of these belongs in source. */
const TENANT_MARKERS: Array<[RegExp, string]> = [
  [/convex\.cloud/, "a Convex deployment URL"],
  [/ingest\.[a-z.]*sentry\.io/, "a Sentry DSN"],
  [/\balmawdah[-.]?api\b/i, "a store's API host"],
  [/\balrahmah\b[^"'\s]*\.cloud/i, "another store's host"],
  [/https:\/\/api\.clinixa\.cloud/, "a shared API host fallback"],
  [/"broken-dudes"/, "a Sentry org"],
  [/"y3xn6e0oda"/, "a Clarity project id"],
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === "convex" || // generated client stubs
      name.startsWith(".")
    )
      continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|mjs)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** Source minus comments — an explanation of the incident is not a value. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("no deployment identity is hardcoded in source", () => {
  const files = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "api")),
    ...walk(join(ROOT, "hooks")),
    ...walk(join(ROOT, "components")),
    join(ROOT, "next.config.mjs"),
  ]

  for (const [pattern, what] of TENANT_MARKERS) {
    it(`contains no ${what}`, () => {
      const offenders = files.filter((f) =>
        pattern.test(code(readFileSync(f, "utf8"))),
      )
      expect(offenders.map((f) => f.replace(ROOT + "/", ""))).toEqual([])
    })
  }
})

describe("no build argument carries a default", () => {
  const DOCKERFILE = readFileSync(join(ROOT, "Dockerfile"), "utf8")

  it("every ARG is declared empty", () => {
    const withDefaults = DOCKERFILE.split("\n")
      .filter((l) => /^ARG \w+=.+/.test(l))
      // PG_MAJOR-style build plumbing is not deployment identity; there are
      // none here today, and anything added must be justified explicitly.
      .map((l) => l.trim())
    expect(withDefaults).toEqual([])
  })
})

describe("the API base has one resolver and no fallback", () => {
  const SRC = code(readFileSync(join(ROOT, "lib/api-base.ts"), "utf8"))

  it("reads only the environment", () => {
    expect(SRC).toContain("process.env.NEXT_PUBLIC_API_BASE_URL")
  })

  it("falls back to same-origin, never to a host", () => {
    // Same-origin fails loudly against this app's own domain. A host would
    // succeed against somebody else's data.
    expect(SRC).not.toMatch(/https?:\/\//)
  })

  it("says so out loud when it is missing", () => {
    expect(SRC).toContain("console.error")
  })
})
