import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Open carts never leave this browser.
 *
 * They used to sync two ways: a per-user row on the API, and a Convex document
 * pushed live to every subscriber. Both were correctly scoped in code. Both
 * leaked anyway — the Convex URL was a Dockerfile DEFAULT, so every shop built
 * from this template joined one realtime database keyed by an account id that
 * is only unique inside a single shop's own database. Two shops' tills showed
 * each other's baskets, and closed carts came back from copies nobody could
 * see.
 *
 * Four separate fixes each moved that bug instead of killing it. The feature
 * is gone now: with nothing to write to and nothing to read from, there is no
 * channel left for a cart to travel down. These tests exist to keep it gone.
 */
const SRC = readFileSync(path.resolve(__dirname, "use-pos-carts.ts"), "utf8")

/** Source minus comments — an explanation is not an implementation. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("nothing about a cart reaches the network", () => {
  it("does not read or write the cart-state endpoint", () => {
    expect(CODE).not.toContain("cartStateGet")
    expect(CODE).not.toContain("cartStatePut")
  })

  it("does not open a realtime subscription", () => {
    expect(CODE).not.toContain("getConvex")
    expect(CODE).not.toContain("cartsApi")
    expect(CODE).not.toContain("onUpdate")
  })

  it("has no code that can replace the cart list from outside", () => {
    // applyRemote was the one function that could swap what is on the till.
    expect(CODE).not.toContain("applyRemote")
    expect(CODE).not.toContain("RemoteState")
  })

  it("performs no fetch of any kind", () => {
    expect(CODE).not.toMatch(/\bfetch\s*\(/)
  })
})

describe("localStorage is the whole story", () => {
  it("keys the saved copy by account", () => {
    // Two accounts on one machine must not read each other's carts back.
    expect(CODE).toContain("alrahmah_pos_carts_v3:${convexAccountId()}")
  })

  it("stamps the account into the blob and checks it on read", () => {
    // Belt to the key's braces: a blob that says whose it is can be refused.
    expect(CODE).toContain("accountId: convexAccountId()")
    expect(CODE).toContain("isMineLocal(data) &&")
  })

  it("accepts an unstamped blob, so nobody loses parked carts on upgrade", () => {
    const fn = CODE.slice(CODE.indexOf("function isMineLocal"))
    expect(fn.slice(0, 200)).toContain("return !id || id === convexAccountId()")
  })
})

describe("a correction cart is never written down at all", () => {
  it("is stripped from every saved copy", () => {
    // Persisting corrections is what let a closed one come back after a
    // refresh, and let failed attempts pile up with no way to clear them.
    const fn = CODE.slice(CODE.indexOf("function persistable"))
    expect(fn.slice(0, 200)).toContain("c.editingSaleId == null")
  })

  it("filters both the debounced write and the immediate flush", () => {
    const uses = CODE.match(/persistable\(/g) ?? []
    expect(uses.length).toBeGreaterThanOrEqual(3) // definition + 2 uses
  })

  it("reuses a correction for the same sale rather than opening a second", () => {
    const fn = CODE.slice(CODE.indexOf("const openSaleForEdit"))
    expect(fn.slice(0, 600)).toContain(
      "cartsRef.current.find((c) => c.editingSaleId === sale.id)",
    )
  })
})
