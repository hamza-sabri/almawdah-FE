import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The idempotency key must be stable per CART, not per attempt.
 *
 * The failure it prevents: on a weak line the cashier presses Enter, sees
 * nothing, and presses the button. Two POSTs go out. If each carries its own
 * client_uuid the server treats them as two different sales and records both —
 * stock down twice, and on a credit sale two debts against the customer. The
 * money is wrong and nobody notices until the till is counted.
 *
 * unique(store, client_uuid) on the backend collapses them, but only if both
 * requests carry the SAME key.
 */

const ROOT = path.resolve(__dirname, "../..")

vi.mock("@/lib/offline/enabled", () => ({ isOfflineEnabled: () => false }))
vi.mock("@/lib/offline/sync-mode", () => ({ canAutoUpload: () => true }))

const salesCreate = vi.hoisted(() => vi.fn())
vi.mock("@/api/sales", () => ({ salesCreate }))

import { submitSale } from "@/lib/offline/submit-sale"

const META = {
  total: 10,
  discountedTotal: 10,
  isReturn: false,
  paymentMethod: "cash" as const,
}
const PAYLOAD = {
  payment_method: "cash" as const,
  items: [{ product: 1, quantity: 1, unit_price: "10.00" }],
}

describe("submitSale never overwrites a caller-supplied client_uuid", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    salesCreate.mockResolvedValue({ data: { id: 1 } })
  })

  it("sends exactly the key it was given", async () => {
    await submitSale({ ...PAYLOAD, client_uuid: "cart-key-1" }, META)
    expect(salesCreate.mock.calls[0][0].client_uuid).toBe("cart-key-1")
  })

  it("sends the SAME key on a retry of the same cart", async () => {
    const body = { ...PAYLOAD, client_uuid: "cart-key-1" }
    await submitSale(body, META)
    await submitSale(body, META) // the cashier pressed the button too
    const [first, second] = salesCreate.mock.calls.map((c) => c[0].client_uuid)
    expect(first).toBe(second)
  })

  it("still mints one when the caller supplies none", async () => {
    await submitSale(PAYLOAD, META)
    expect(salesCreate.mock.calls[0][0].client_uuid).toBeTruthy()
  })
})

describe("the POS supplies a cart-scoped key", () => {
  // A source-level assertion, deliberately. The wiring is what breaks — the
  // previous version minted the uuid inside submitSale on every attempt, which
  // type-checks, passes every other test, and silently doubles sales.
  const pos = readFileSync(
    path.join(ROOT, "app", "(app)", "pos", "page.tsx"),
    "utf8",
  )
  const carts = readFileSync(
    path.join(ROOT, "hooks", "use-pos-carts.ts"),
    "utf8",
  )

  it("buildPayload puts the cart's key on the request", () => {
    // Conditional since sales can also be CORRECTED in place: a correction
    // PATCHes an existing sale, where a fresh idempotency key would mean
    // nothing. Every cart that rings a NEW sale still carries the cart's own
    // stable key, which is what stops a retry becoming a second sale.
    expect(pos).toMatch(
      /client_uuid:\s*editingSaleId != null \? undefined : pos\.ensureSaleUuid\(\)/,
    )
  })

  it("the key is minted with the cart and lives on it", () => {
    expect(carts).toMatch(/saleUuid:\s*uuid\(\)/)
    expect(carts).toContain("ensureSaleUuid")
  })

  it("a second submit for the same cart is blocked while one is in flight", () => {
    // The POS mounts three independent useCheckout mutations, so each button's
    // own isPending cannot see the others.
    expect(pos).toContain("inFlightCarts")
  })
})
