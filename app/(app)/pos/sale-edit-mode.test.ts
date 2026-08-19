import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Correcting a sale instead of re-ringing it.
 *
 * The cashier rang the wrong item and the customer is still at the counter.
 * Voiding and re-ringing leaves the paper already in their hand pointing at a
 * dead invoice, and shows two sales in the day for one basket — so the sale is
 * edited in place.
 *
 * Everything asserted here is a way that goes wrong silently: a correction
 * that quietly creates a SECOND sale, one that moves the receipt number off
 * the printed paper, or one that gets queued offline and replayed hours later
 * over somebody else's change. None of those raise an error at the till.
 */
const POS = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")
const CART = readFileSync(
  path.resolve(__dirname, "../../../hooks/use-pos-carts.ts"),
  "utf8",
)
const LINK = readFileSync(
  path.resolve(__dirname, "../../../hooks/use-sale-edit-link.ts"),
  "utf8",
)

/** Source with comments removed — an explanation that mentions a name must
 *  not read as the code still using it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/** One function body, bounded by the next declaration. */
function sliceFn(src: string, start: string): string {
  const from = src.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  const next = src.indexOf("\n  const ", from + start.length)
  return src.slice(from, next === -1 ? undefined : next)
}

describe("the cart knows which sale it is correcting", () => {
  it("carries the sale id, so the state survives parking and a reload", () => {
    expect(CART).toContain("editingSaleId?: number")
  })

  it("reuses the cart already open for that sale", () => {
    // Tap the pencil, get distracted, tap it again: two carts editing one
    // invoice means only the last save survives, silently.
    const fn = sliceFn(CART, "const openSaleForEdit")
    expect(fn).toContain("c.editingSaleId === sale.id")
  })
})

describe("a correction keeps the original sale's identity", () => {
  const fn = POS.slice(POS.indexOf("function buildPayload"))

  it("hands the sale id to the checkout", () => {
    expect(fn).toContain("editingSaleId")
    expect(fn).toContain("return { body, snapshot, editingSaleId }")
  })

  it("mints no new idempotency key", () => {
    // A fresh client_uuid on a correction is meaningless at best; the create
    // path's dedup is about retries of a NEW sale.
    expect(fn).toContain(
      "client_uuid: editingSaleId != null ? undefined : pos.ensureSaleUuid()",
    )
  })

  it("mints no new receipt number", () => {
    // The barcode is on paper the customer is holding.
    expect(fn).toMatch(/receipt_code:\s*\n?\s*editingSaleId != null \? undefined/)
  })

  it("sends a null customer on a correction, so debt → cash detaches them", () => {
    // `undefined` is dropped by JSON.stringify, so PATCH would leave the old
    // customer attached and the debt with it.
    expect(fn).toContain("editingSaleId != null\n        ? null")
  })
})

describe("saving the correction", () => {
  it("PATCHes the sale rather than posting a new one", () => {
    expect(POS).toContain("await salesUpdate(editingSaleId, body)")
  })

  it("never sends a correction through the offline queue", () => {
    // submitSale queues when unreachable and replays later. Replaying a
    // correction could overwrite a change made in between, hours later, with
    // nobody watching.
    const fn = POS.slice(POS.indexOf("mutationFn: async ({"))
    const branch = fn.slice(0, fn.indexOf("const res = await submitSale"))
    expect(branch).toContain("navigator.onLine === false")
    expect(branch).toContain("تعديل الفاتورة يحتاج اتصالاً")
  })

  it("says it edited, not that it sold", () => {
    expect(POS).toContain("تم تعديل الفاتورة")
  })

  it("labels the button as a save, so nobody rings a sale by accident", () => {
    expect(POS).toContain('"حفظ التعديل"')
  })

  it("shows a banner while the cart is a correction", () => {
    expect(POS).toContain("active.editingSaleId != null &&")
    // Says BOTH halves: the same invoice is updated, and the old version is
    // still there. "سيتم حفظ النسخة السابقة" alone read as "a copy gets saved
    // somewhere" without answering the question the cashier is actually asking.
    expect(POS).toContain("ستُحدَّث الفاتورة نفسها")
    expect(POS).toContain("وتبقى النسخة السابقة محفوظة في السجل")
  })
})

describe("the ?edit= parameter actually reaches the page", () => {
  it("wraps the POS in a Suspense boundary", () => {
    // Without one, Next's static prerender hands the client component an EMPTY
    // parameter set and never re-renders it with the real query string. The
    // link works, the id is in the URL, and the till just shows an empty cart —
    // no error anywhere. This is exactly how it failed the first time.
    expect(POS).toContain("<Suspense fallback={null}>")
    expect(POS).toContain("<PosPageInner />")
    expect(POS).toMatch(/export default function PosPage\(\)/)
  })

  it("keeps the hook that reads it inside that boundary", () => {
    const inner = POS.slice(POS.indexOf("function PosPageInner"))
    expect(inner).toContain("useSaleEditLink(pos.openSaleForEdit)")
  })
})

describe("the cross-device cart sync cannot eat a correction", () => {
  it("rescues a correction the remote snapshot predates", () => {
    // The server copy is fetched on mount, before the cashier taps the pencil.
    // Applying it wholesale a moment later deletes the cart she is looking at.
    const fn = sliceFn(CART, "const applyRemote")
    expect(fn).toContain("c.editingSaleId != null")
    expect(fn).toContain("!incoming.some((r) => r.id === c.id)")
  })

  it("rescues ONLY corrections", () => {
    // An ordinary cart missing from the remote copy usually means another till
    // closed it; bringing those back would undo that.
    const fn = sliceFn(CART, "const applyRemote")
    expect(fn).toContain("rescued.length > 0 ? [...incoming, ...rescued] : incoming")
  })

  it("leaves the focus on the correction being edited", () => {
    const fn = sliceFn(CART, "const applyRemote")
    expect(fn).toContain("rescued.some((c) => c.id === cur)")
  })

  it("commits the correction cart immediately instead of waiting to be raced", () => {
    // The rescue above reads a ref that only updates on render, so it cannot
    // be the only defence. Stamping a newer savedAt makes the in-flight server
    // snapshot lose on arrival rather than win.
    const fn = sliceFn(CART, "const openSaleForEdit")
    expect(fn).toContain("flushNow(next, c.id)")
  })
})

describe("opening a sale from the sales page", () => {
  it("reads the ONE sale by id, not a filtered list", () => {
    // The sales filterset has no `id` filter, so `?id=` is ignored and the
    // first page comes back — the cashier would edit the newest sale instead
    // of the one she tapped, and only find out after saving.
    expect(LINK).toContain("salesGet(id)")
    expect(LINK).not.toContain("salesList(")
  })

  it("clears the ?edit= parameter once the cart is open", () => {
    // Otherwise a refresh opens a second correction on top of the first.
    expect(LINK).toContain('router.replace("/pos")')
  })

  it("does not re-open on a double effect run", () => {
    expect(LINK).toContain("handled.current === editId")
  })

  it("has NO second `cancelled` flag racing that guard", () => {
    // The two together cancel each other out. React's dev remount runs the
    // effect, cleans it up (cancelled = true), and runs it again; the second
    // run short-circuits on the ref and fires nothing, so the first run's
    // response arrives, sees `cancelled`, and is discarded. The request goes
    // out, the server answers 200, and the till shows an empty cart with no
    // error anywhere. That is exactly how this shipped broken.
    expect(code(LINK)).not.toContain("cancelled")
  })

  it("acts on the response unconditionally once it has decided to fetch", () => {
    const fn = LINK.slice(LINK.indexOf("void salesGet(id)"))
    expect(fn).toContain("openSaleForEdit({")
    expect(fn).toContain('router.replace("/pos")')
  })
})
