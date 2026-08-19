import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Realtime cart sync must be opt-in, per deployment.
 *
 * The Dockerfile used to default NEXT_PUBLIC_CONVEX_URL to one shared Convex
 * deployment. An ARG default applies whenever the platform does not pass that
 * argument — so every store built from this template joined the same realtime
 * database, while the deploy's build-args list showed no Convex variable and
 * read as "Convex is off". That is how two shops' tills ended up showing each
 * other's open baskets, live.
 */
const DOCKERFILE = readFileSync(
  path.resolve(__dirname, "..", "Dockerfile"),
  "utf8",
)

describe("the Convex build argument", () => {
  it("defaults to EMPTY — never to somebody's deployment", () => {
    const line = DOCKERFILE.split("\n").find((l) =>
      l.startsWith("ARG NEXT_PUBLIC_CONVEX_URL"),
    )
    expect(line).toBe("ARG NEXT_PUBLIC_CONVEX_URL=")
  })

  it("hardcodes no convex.cloud host anywhere in the image build", () => {
    expect(DOCKERFILE).not.toMatch(/convex\.cloud/)
  })
})
