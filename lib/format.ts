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
