import { describe, it, expect } from "vitest"
import { sanitizeQtyInput } from "@/lib/format"

/**
 * The POS quantity field is a text input (a native number input loses the
 * caret and leading-zero behaviour a till needs). So what the cashier types is
 * filtered as they type.
 *
 * The failure this prevents: a letter reaching commit() becomes NaN, the
 * component treats NaN as 0, and 0 removes the line. One mistyped key silently
 * deleting an item from a customer's basket — noticed, if at all, at the total.
 */
describe("the quantity field takes numbers, never text", () => {
  it("keeps plain digits", () => {
    expect(sanitizeQtyInput("12")).toBe("12")
  })

  it("keeps fractions — half a kilo is a real sale", () => {
    expect(sanitizeQtyInput("0.5")).toBe("0.5")
    expect(sanitizeQtyInput("1.25")).toBe("1.25")
  })

  it("drops letters entirely", () => {
    expect(sanitizeQtyInput("abc")).toBe("")
    expect(sanitizeQtyInput("12kg")).toBe("12")
    expect(sanitizeQtyInput("a1b2")).toBe("12")
  })

  it("drops symbols and spaces", () => {
    expect(sanitizeQtyInput("1 2")).toBe("12")
    expect(sanitizeQtyInput("-5")).toBe("5")
    expect(sanitizeQtyInput("١٢٣!@#")).toBe("123")
  })

  it("accepts the Arabic-Indic digits the cashiers' keyboard produces", () => {
    expect(sanitizeQtyInput("٢")).toBe("2")
    expect(sanitizeQtyInput("١٢٣")).toBe("123")
    // ٫ is the Arabic decimal separator, not a comma
    expect(sanitizeQtyInput("١٫٥")).toBe("1.5")
  })

  it("treats a typed comma as a decimal point", () => {
    expect(sanitizeQtyInput("1,5")).toBe("1.5")
  })

  it("allows only one separator", () => {
    expect(sanitizeQtyInput("1.2.3")).toBe("1.23")
    expect(sanitizeQtyInput("1..5")).toBe("1.5")
  })

  it("allows a trailing separator so a decimal can be typed at all", () => {
    // Mid-typing state: "1." must survive or the "." can never be entered.
    expect(sanitizeQtyInput("1.")).toBe("1.")
  })

  it("caps the decimals at 3, matching numeric(12,3)", () => {
    expect(sanitizeQtyInput("1.23456")).toBe("1.234")
  })

  it("caps the whole part, so no input can overflow the column", () => {
    // The audit found a Postgres numeric overflow aborting a whole
    // transaction; the API still 500s on one. The field will not produce it.
    expect(sanitizeQtyInput("12345678901234")).toBe("123456789")
  })

  it("leaves an empty field empty — blank still means remove the line", () => {
    expect(sanitizeQtyInput("")).toBe("")
  })
})
