/**
 * The number printed as a barcode on every receipt.
 *
 * Twelve digits — YYMMDD then six random — for two reasons:
 *   • Code 128 packs an even run of digits two-per-symbol (subset C), so the
 *     bars stay narrow enough to scan off a 58mm roll.
 *   • The date is readable off the paper without a scanner, which is how the
 *     owner narrows a search when the ink has smudged.
 *
 * It is minted HERE, on the till, not on the server. A sale rung up during an
 * internet cut prints its receipt before the server has ever heard of it; a
 * server-side number would leave that paper permanently unfindable. The server
 * keeps whatever it is sent unless it is malformed or already used in this
 * store, in which case it mints its own — so a duplicate can never shadow an
 * older sale.
 */

const DIGITS = 6

function random6(): number {
  const c = typeof crypto !== "undefined" ? crypto : undefined
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1)
    c.getRandomValues(buf)
    return buf[0] % 1_000_000
  }
  return Math.floor(Math.random() * 1_000_000)
}

export function newReceiptCode(when: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  const date = `${p(when.getFullYear() % 100)}${p(when.getMonth() + 1)}${p(when.getDate())}`
  return `${date}${String(random6()).padStart(DIGITS, "0")}`
}

/** Exactly twelve digits — anything else the scanner would read back wrong. */
export function isReceiptCode(v: unknown): v is string {
  return typeof v === "string" && /^[0-9]{12}$/.test(v)
}
