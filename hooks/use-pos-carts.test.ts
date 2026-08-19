import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Open carts must never cross accounts.
 *
 * Two cashiers logged in on the same shop saw each other's baskets. The
 * storage key, the server row, the Convex document and the Redis key are each
 * scoped by account — but the blob itself carried no identity, so once any one
 * of those layers handed over the wrong copy there was nothing left to catch
 * it, and the first sign was a stranger's basket appearing mid-sale.
 *
 * The blob is now stamped and checked. These assert the stamp is on every
 * write and the check on every read, because a single missed path is the whole
 * bug back again.
 */
const SRC = readFileSync(
  path.resolve(__dirname, "use-pos-carts.ts"),
  "utf8",
)

/** Source minus comments — an explanation is not an implementation. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("every saved copy says whose it is", () => {
  it("stamps the account on each write path", () => {
    // localStorage (x2 early-return branches), the debounced push, and
    // flushNow — four writes, and the subscription arg.
    const stamps = CODE.match(/accountId: convexAccountId\(\)/g) ?? []
    expect(stamps.length).toBeGreaterThanOrEqual(5)
  })

  it("keys storage by account as well — belt and braces", () => {
    expect(CODE).toContain("alrahmah_pos_carts_v3:${convexAccountId()}")
  })
})

describe("every incoming copy is checked", () => {
  it("checks inside applyRemote, so no call site can forget", () => {
    const fn = CODE.slice(CODE.indexOf("const applyRemote"))
    expect(fn.slice(0, 400)).toContain("if (!isMineRemote(remote)) return")
  })

  it("checks the server copy on hydrate", () => {
    const fn = CODE.slice(CODE.indexOf("void cartStateGet()"))
    expect(fn.slice(0, 400)).toContain("if (!isMineRemote(remote)) return")
  })

  it("checks the localStorage copy on hydrate", () => {
    expect(CODE).toContain("isMineLocal(data) &&")
  })

  it("checks the realtime push", () => {
    const fn = CODE.slice(CODE.indexOf("convex.onUpdate"))
    expect(fn.slice(0, 600)).toContain("if (!isMineRemote(row.data)) return")
  })

  it("rejects a foreign blob BEFORE it can move the watermark", () => {
    // Otherwise a leak becomes a silent desync: the foreign savedAt would
    // block the next legitimate update from this account.
    const fn = CODE.slice(CODE.indexOf("convex.onUpdate"))
    const check = fn.indexOf("isMineRemote(row.data)")
    const watermark = fn.indexOf("lastSavedAt.current = savedAt")
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(watermark)
  })
})

describe("what counts as mine", () => {
  it("a REMOTE copy must be stamped — unstamped is refused", () => {
    // That is the path carts actually arrived on from another account. An
    // unstamped remote blob is either pre-stamp (its owner re-sends it stamped
    // within a shift) or it is the leak.
    const fn = CODE.slice(CODE.indexOf("function isMineRemote"))
    expect(fn.slice(0, 300)).toContain("return state?.accountId === me")
  })

  it('never treats "anon" as an identity', () => {
    // A device that cannot read its own token would otherwise match every
    // other device that also could not — which is a shared account, not none.
    const fn = CODE.slice(CODE.indexOf("function isMineRemote"))
    expect(fn.slice(0, 300)).toContain('me === "anon"')
  })

  it("a LOCAL copy may be unstamped, so nobody loses parked carts on upgrade", () => {
    const fn = CODE.slice(CODE.indexOf("function isMineLocal"))
    expect(fn.slice(0, 200)).toContain("return !id || id === convexAccountId()")
  })
})

describe("a correction never leaves this browser session", () => {
  it("is stripped from every saved copy", () => {
    // Persisting corrections is what let a closed one come back after a
    // refresh, put a basket nobody created on the other till, and let failed
    // attempts pile up with no way to clear them.
    const fn = CODE.slice(CODE.indexOf("function persistable"))
    expect(fn.slice(0, 200)).toContain("c.editingSaleId == null")
  })

  it("filters localStorage, the debounced push, and the immediate flush", () => {
    // Four call sites: two localStorage early-return branches, the debounced
    // payload, and flushNow. Miss one and the ghost is back.
    const uses = CODE.match(/persistable\(/g) ?? []
    expect(uses.length).toBeGreaterThanOrEqual(5) // 1 definition + 4 uses
  })

  it("never writes an EMPTY list to the server", () => {
    // A screen holding only corrections has nothing to save — and an empty
    // list is last-write-wins over another till's genuinely parked basket.
    const push = CODE.slice(CODE.indexOf("const savedAt = Date.now()"))
    expect(push).toContain("if (keep.length === 0) return")
    const flush = CODE.slice(CODE.indexOf("const flushNow"))
    expect(flush).toContain("if (keep.length === 0) return")
  })
})

describe("the correction-cart rescue cannot hoard strangers' carts", () => {
  it("only rescues carts this device opened", () => {
    // "Any cart that looks like an edit" would rescue a foreign one on every
    // sync, forever — which is several strangers' corrections piling up on one
    // till and none of them clearing.
    const fn = CODE.slice(CODE.indexOf("const applyRemote"))
    expect(fn.slice(0, 900)).toContain("myEditCarts.current.has(c.id)")
  })

  it("records a correction cart when it opens it", () => {
    const fn = CODE.slice(CODE.indexOf("const openSaleForEdit"))
    expect(fn).toContain("myEditCarts.current.add(c.id)")
  })

  it("forgets it when the cart closes, so the set cannot grow forever", () => {
    const fn = CODE.slice(CODE.indexOf("const closeCart"))
    expect(fn.slice(0, 300)).toContain("myEditCarts.current.delete(id)")
  })

  it("reuses a correction for the same sale even across a reload", () => {
    // myEditCarts is per page-load. Gating the REUSE on it meant a correction
    // that survived a reload was invisible, so the pencil opened a second cart
    // for the same sale — three sales, three carts, none clearing.
    const fn = CODE.slice(CODE.indexOf("const openSaleForEdit"))
    const head = fn.slice(0, 600)
    expect(head).toContain("cartsRef.current.find((c) => c.editingSaleId === sale.id)")
    expect(head).not.toContain("&& myEditCarts.current.has(c.id)")
  })

  it("adopts a reused correction so the rescue still protects it", () => {
    const fn = CODE.slice(CODE.indexOf("const openSaleForEdit"))
    expect(fn.slice(0, 700)).toContain("myEditCarts.current.add(existing.id)")
  })
})
