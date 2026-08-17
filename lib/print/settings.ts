"use client"

/**
 * Receipt / label print settings — stored per browser (localStorage) so each
 * counter can be set up once with its printer's paper size and the store's
 * own header + logo.
 *
 * The logo is the swappable slot: `logoDataUrl` holds a base64 image the owner
 * uploads in the print settings dialog. Until then we fall back to an indigo
 * wordmark of the store name (see receipt.ts) — nothing blocks on the final
 * brand/logo decision.
 */

export type PaperWidth = "58" | "80"

export type PrintSettings = {
  /** Header name; empty = fall back to the tenant's pharmacy_name from /me/. */
  pharmacyName: string
  phone: string
  address: string
  /** Base64 data URL of the uploaded logo, or "" for the wordmark fallback. */
  logoDataUrl: string
  /** Free line under the items (e.g. "شكراً لزيارتكم — سلامتكم تهمّنا"). */
  footer: string
  paper: PaperWidth
  /** Print a receipt automatically after every completed sale. */
  autoPrint: boolean
  /** Show the sale number as a scannable barcode at the foot of the receipt. */
  receiptBarcode: boolean
}

const KEY = "pharma_print_settings_v1"
const MIG_AUTOPRINT_OFF = "pharma_print_ap_off_v1"

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  pharmacyName: "",
  phone: "",
  address: "",
  logoDataUrl: "",
  footer: "شكراً لزيارتكم 🌿 سلامتكم تهمّنا",
  paper: "80",
  // Off by default — receipts print only when the cashier explicitly asks
  // (reprint from the sale, or turns this on).
  autoPrint: false,
  receiptBarcode: true,
}

export function loadPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return { ...DEFAULT_PRINT_SETTINGS }
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PrintSettings>) : {}
    const merged = { ...DEFAULT_PRINT_SETTINGS, ...parsed }
    // One-time migration: auto-print used to default ON. Force it OFF once for
    // everyone; after that the cashier's own toggle is respected.
    if (window.localStorage.getItem(MIG_AUTOPRINT_OFF) !== "1") {
      merged.autoPrint = false
      window.localStorage.setItem(MIG_AUTOPRINT_OFF, "1")
      window.localStorage.setItem(KEY, JSON.stringify(merged))
    }
    return merged
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS }
  }
}

export function savePrintSettings(next: PrintSettings): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    // Let any open settings dialog / indicator in this tab react immediately.
    window.dispatchEvent(new CustomEvent("pharma-print-settings"))
  } catch {
    /* storage full — settings just won't persist */
  }
}
