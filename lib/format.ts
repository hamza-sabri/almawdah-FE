// Plain Western digits everywhere (12,345.50) — Arabic-Indic digits with the
// ٫ decimal separator read like commas and confused everyone.
const numberFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const intFmt = new Intl.NumberFormat("en-US")

/** Format a money value (string | number) as `93.50 ₪`. */
export function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0)
  if (!Number.isFinite(n)) return "0.00 ₪"
  return `${numberFmt.format(n)} ₪`
}

export function formatNumber(value: number | null | undefined): string {
  return intFmt.format(value ?? 0)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  // Arabic month names, Latin digits.
  return new Intl.DateTimeFormat("ar-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Keep a quantity field numeric while the cashier types.
 *
 * The field is a text input (a native number input drops the leading-zero and
 * caret behaviour a POS needs, and hides the value from the barcode-burst
 * detector). Text input meant anything could be typed — and `commit()` runs
 * the result through parseFloat, where a stray letter becomes NaN, which the
 * component treats as 0, which DELETES the line. One mistyped key silently
 * removing an item from a customer's basket is not an acceptable failure.
 *
 * So: filter as they type. Digits and a single decimal point survive;
 * everything else never lands.
 *
 * Arabic-Indic digits (٠-٩) and the Arabic decimal separator (٫) are
 * normalised rather than rejected — this keyboard is the one the cashiers
 * actually have, and rejecting their digits would read as the field being
 * broken.
 *
 * Bounds mirror the column: quantity is numeric(12,3), so at most 3 decimals,
 * and 9 integer digits keeps any input far below the overflow that makes
 * Postgres abort a transaction.
 */
export function sanitizeQtyInput(raw: string): string {
  const AR = "٠١٢٣٤٥٦٧٨٩"
  let s = raw.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
  s = s.replace(/[٫,]/g, ".") // Arabic decimal separator, and a typed comma
  s = s.replace(/[^0-9.]/g, "")

  // At most one separator: keep the first, drop the rest.
  const dot = s.indexOf(".")
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "")
  }

  const [whole = "", frac] = s.split(".")
  const head = whole.slice(0, 9)
  if (frac === undefined) return head
  return `${head}.${frac.slice(0, 3)}`
}
