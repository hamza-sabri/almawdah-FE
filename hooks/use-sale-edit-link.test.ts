import { describe, it, expect } from "vitest"

import { saleToCartLines } from "@/hooks/use-sale-edit-link"
import type { Sale } from "@/api/sales"

/**
 * Turning a saved sale back into a cart.
 *
 * Every field that survives this trip is one the correction will send back to
 * the server. Anything dropped here is silently lost from the invoice the
 * moment the cashier presses save — which is why each of these is asserted
 * rather than trusted.
 */

const SALE = {
  id: 7,
  receipt_code: "260819123456",
  customer: null,
  payment_method: "cash",
  total: "37.00",
  discounted_total: "37.00",
  debt: null,
  note: "",
  created_at: "",
  updated_at: "",
  items: [
    {
      id: 1,
      product: 12,
      variant: null,
      medication_name: "أرز",
      unit_price: "10.00",
      quantity: 2,
      line_total: "20.00",
    },
    {
      id: 2,
      product: 30,
      variant: 4,
      medication_name: "زيت",
      variant_label: "عبوة ×12",
      unit_price: "15.00",
      // haggled down from 17 — the override has to stay recognisable
      original_unit_price: "17.00",
      quantity: 1,
      line_total: "15.00",
    },
    {
      // a top-up / free-text line: no product at all, the name IS the item
      id: 3,
      product: null,
      variant: null,
      medication_name: "شحن رصيد جوال",
      unit_price: "2.00",
      quantity: 1,
      line_total: "2.00",
    },
  ],
} as unknown as Sale

describe("reopening a sale as a cart", () => {
  const lines = saleToCartLines(SALE)

  it("keeps every line", () => {
    expect(lines).toHaveLength(3)
  })

  it("keeps the product and variant ids, so stock moves on the right rows", () => {
    expect(lines[0].medicationId).toBe(12)
    expect(lines[1].medicationId).toBe(30)
    expect(lines[1].variantId).toBe(4)
  })

  it("keeps a free-text line as free text, not as a broken product", () => {
    expect(lines[2].medicationId).toBeNull()
    expect(lines[2].name).toBe("شحن رصيد جوال")
  })

  it("charges what the sale charged, not what the catalogue says today", () => {
    expect(lines[0].unitPrice).toBe("10.00")
    expect(lines[1].unitPrice).toBe("15.00")
  })

  it("remembers a price override as an override", () => {
    // basePrice is the catalogue price; unitPrice is what was charged. If this
    // came back as 15/15 the haggle would look like the normal price and the
    // owner would lose the only record that it was a discount.
    expect(lines[1].basePrice).toBe("17.00")
    expect(lines[1].unitPrice).toBe("15.00")
  })

  it("treats an unoverridden line as no override", () => {
    expect(lines[0].basePrice).toBe(lines[0].unitPrice)
  })

  it("keeps quantities as numbers the stepper can work with", () => {
    expect(lines[0].quantity).toBe(2)
    expect(typeof lines[0].quantity).toBe("number")
  })

  it("gives every line a distinct key", () => {
    expect(new Set(lines.map((l) => l.key)).size).toBe(3)
  })

  it("keeps the variant label so the cart reads like the receipt", () => {
    expect(lines[1].variantLabel).toBe("عبوة ×12")
  })
})
