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
  /**
   * What "print" does at this counter.
   *
   *   "print"    → send it to the printer (Chrome must be launched with
   *                --kiosk-printing, or the OS dialog appears — see
   *                docs/PRINTING.md)
   *   "download" → save the receipt as a file instead, no dialog ever
   *
   * A browser cannot ask the OS whether a printer exists, so a till with no
   * printer says so HERE, once, instead of the app guessing wrong every sale.
   */
  deliver: "print" | "download"
  /**
   * Which printer to send receipts to. Empty = whatever the OS calls default.
   *
   * Not optional in practice: a Windows till commonly defaults to Microsoft
   * Print to PDF, and then every receipt is a silent download instead of
   * paper. Chosen per browser, like the rest of these.
   */
  printerName: string
}

const KEY = "pharma_print_settings_v1"
const MIG_AUTOPRINT_OFF = "pharma_print_ap_off_v1"

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  pharmacyName: "",
  phone: "",
  address: "",
  logoDataUrl: "",
  // Not printed any more — the space under the total belongs to the barcode,
  // which is what the owner scans to pull a sale back up. The key stays so
  // settings saved by an older build still parse.
  footer: "",
  paper: "80",
  // Off by default — receipts print only when the cashier explicitly asks
  // (reprint from the sale, or turns this on).
  autoPrint: false,
  receiptBarcode: true,
  deliver: "print",
  printerName: "",
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
