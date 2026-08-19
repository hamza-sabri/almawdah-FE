"use client"

/**
 * Browser thermal-receipt + barcode-label printing.
 *
 * No native driver, no WebUSB, no special hardware to start: we build a
 * print-optimised HTML document sized for a 58/80 mm roll (`@page size`), drop
 * it into a hidden iframe and call `window.print()`. That routes through the OS
 * print dialog, so it works with any installed printer — a cheap USB/Bluetooth
 * thermal printer set to 58/80 mm, or a normal A4 printer while testing.
 *
 * Arabic RTL layout, swappable logo slot (see settings.ts).
 *
 * Deliberately BLACK ONLY. A thermal roll has no colour to print with, and on
 * a colour printer the tinted badges came out as grey blocks that ate ink and
 * made the paper harder to read. Everything here is #000 on white.
 */

import { formatMoney } from "@/lib/format"
import { barcodeSvg } from "@/lib/print/barcode"
import {
  DEFAULT_PRINT_SETTINGS,
  loadPrintSettings,
  type PrintSettings,
} from "@/lib/print/settings"

// Shelf LABELS still use the brand colours — they are printed on a colour
// printer onto sticker sheets. Receipts do not: see baseStyles below.
const BRAND_INK = "#201f38"
const BRAND_INDIGO = "#5B5CE2"

export type ReceiptItem = {
  name: string
  quantity: number
  unitPrice: string | number
  lineTotal?: string | number
}

export type ReceiptData = {
  saleId?: number | string
  items: ReceiptItem[]
  /** Sum before discount. */
  total: number
  /** Amount actually charged. */
  discountedTotal: number
  paymentMethod: "cash" | "debt"
  isReturn?: boolean
  customerName?: string
  cashierName?: string
  createdAt?: string | Date
  /**
   * Sale hasn't reached the server yet (queued offline). Kept because it
   * suppresses the barcode for a quote, but it is no longer PRINTED: the
   * customer has no use for the till's sync state, and the owner reads it off
   * the sales list, where it is a live fact rather than one frozen on paper.
   */
  offline?: boolean
  /**
   * The 12-digit number printed as the barcode. This — not the sale id — is
   * what the owner scans to find the sale, because it exists before the sale
   * reaches the server.
   */
  receiptCode?: string
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  )
}

function toNum(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : (v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmtDate(value?: string | Date): string {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The store header — the store's own logo (from the account) or an
 *  uploaded local one, else an indigo wordmark of the name. */
function headerHtml(name: string, s: PrintSettings, logoUrl = ""): string {
  const logoSrc = logoUrl || s.logoDataUrl
  const logo = logoSrc
    ? `<img class="logo" src="${esc(logoSrc)}" alt="" />`
    : `<div class="wordmark">${esc(name)}</div>`
  const lines = [
    logoSrc && name ? `<div class="name">${esc(name)}</div>` : "",
    s.phone ? `<div class="muted">${esc(s.phone)}</div>` : "",
    s.address ? `<div class="muted">${esc(s.address)}</div>` : "",
  ]
    .filter(Boolean)
    .join("")
  return `<div class="head">${logo}${lines}</div>`
}

function baseStyles(paperMm: number): string {
  // Content width leaves ~3mm of breathing room inside the roll.
  const content = paperMm - 6
  return `
    @page { size: ${paperMm}mm auto; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${content}mm;
      margin: 0 auto;
      padding: 3mm 0 4mm;
      font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
      color: #000;
      direction: rtl;
      font-size: 12px;
      line-height: 1.5;
    }
    .head { text-align: center; margin-bottom: 6px; }
    .logo { max-width: ${content - 4}mm; max-height: 20mm; object-fit: contain; }
    .wordmark { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; }
    .name { font-weight: 700; font-size: 13px; margin-top: 2px; }
    .muted { font-size: 11px; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .meta { font-size: 11px; }
    .meta .row { display: flex; justify-content: space-between; gap: 8px; }
    /* No tint: a thermal roll cannot print colour, and on a colour printer
       these came out as grey blocks. A border says the same thing in black. */
    .badge {
      display: block; margin: 4px auto; padding: 2px 10px;
      border: 1px solid #000; font-weight: 700; font-size: 12px; text-align: center;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; font-size: 11px; vertical-align: top; }
    thead th { border-bottom: 1px solid #000; font-weight: 700; text-align: right; }
    .c-qty { text-align: center; white-space: nowrap; }
    .c-amt { text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .it-name { font-weight: 600; }
    .totals { margin-top: 4px; font-size: 12px; }
    .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }
    .totals .grand { font-weight: 800; font-size: 15px; border-top: 1px solid #000; margin-top: 3px; padding-top: 4px; }
    /* The barcode is the only thing under the total now — no thank-you line,
       no sync notice. It is what the owner scans to pull this sale back up. */
    .foot { text-align: center; margin-top: 10px; }
    .foot .num { font-size: 11px; letter-spacing: 2px; font-variant-numeric: tabular-nums; }
  `
}

function receiptBodyHtml(data: ReceiptData, name: string, s: PrintSettings, logoUrl = ""): string {
  const rows = data.items
    .map((it) => {
      const line = it.lineTotal != null ? toNum(it.lineTotal) : toNum(it.unitPrice) * it.quantity
      return `
      <tr>
        <td class="it-name">${esc(it.name)}<div class="muted">${esc(formatMoney(it.unitPrice))}</div></td>
        <td class="c-qty">${it.quantity}</td>
        <td class="c-amt">${esc(formatMoney(line))}</td>
      </tr>`
    })
    .join("")

  const discount = data.total - data.discountedTotal
  const payLabel = data.paymentMethod === "debt" ? "دين (آجل)" : "نقدي"

  // Only the return marker survives. The sync state was printed as a warning
  // badge; it is the till's business, not the customer's, and by the time
  // anyone reads the paper it is usually no longer true.
  const badges = data.isReturn ? `<div class="badge">فاتورة إرجاع</div>` : ""

  // The receipt number, as a scannable barcode. Falls back to the sale id so a
  // sale recorded before this feature still prints something.
  const code = data.receiptCode || (data.saleId != null ? String(data.saleId) : "")
  // Narrower bars on a 58mm roll. At moduleWidth 1.6 a 12-digit Code 128 comes
  // out 51.2mm wide inside a 52mm printable area — it "fits" with 0.8mm to
  // spare, which the roll drifting in its holder eats on the first jam. 1.15
  // gives ~37mm and still decodes cleanly at a thermal head's 203dpi (checked
  // by feeding the rendered receipt back through the app's own zbar decoder).
  const narrow = s.paper === "58"
  const barcode =
    s.receiptBarcode && code
      ? (barcodeSvg(code, {
          moduleWidth: narrow ? 1.15 : 1.6,
          height: narrow ? 34 : 40,
        }) ?? "")
      : ""

  return `
    ${headerHtml(name, s, logoUrl)}
    <div class="rule"></div>
    ${badges}
    <div class="meta">
      <div class="row"><span>${data.isReturn ? "إرجاع رقم" : "فاتورة رقم"}</span><span>${esc(code || data.saleId || "—")}</span></div>
      <div class="row"><span>التاريخ</span><span>${esc(fmtDate(data.createdAt))}</span></div>
      <div class="row"><span>الدفع</span><span>${payLabel}</span></div>
      ${data.customerName ? `<div class="row"><span>الزبون</span><span>${esc(data.customerName)}</span></div>` : ""}
      ${data.cashierName ? `<div class="row"><span>الكاشير</span><span>${esc(data.cashierName)}</span></div>` : ""}
    </div>
    <div class="rule"></div>
    <table>
      <thead>
        <tr><th>الصنف</th><th class="c-qty">كمية</th><th class="c-amt">المجموع</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rule"></div>
    <div class="totals">
      <div class="row"><span>الإجمالي</span><span>${esc(formatMoney(data.total))}</span></div>
      ${discount > 0.001 ? `<div class="row"><span>الخصم</span><span>- ${esc(formatMoney(discount))}</span></div>` : ""}
      <div class="row grand"><span>${data.isReturn ? "المبلغ المُعاد" : "المطلوب"}</span><span>${esc(formatMoney(data.discountedTotal))}</span></div>
    </div>
    <div class="foot">
      ${barcode ? `${barcode}<div class="num">${esc(code)}</div>` : ""}
    </div>
  `
}

/**
 * What actually happened when we tried to print.
 *
 * A browser cannot enumerate printers — there is no API for "is a printer
 * connected". What it CAN tell us is whether the print pipeline itself
 * worked: `window.print()` throws (or does not exist) in a WebView or a
 * locked-down kiosk browser with no print support. That is the case we can
 * detect and recover from, by handing the cashier a file instead. A machine
 * with a print dialog but no printer behind it is indistinguishable from a
 * healthy one, so the download link is offered on the toast either way.
 */
export type PrintOutcome = "agent" | "printed" | "downloaded" | "unavailable"

/** Save the receipt as a self-contained file the cashier can open and print
 *  later — the fallback when this device cannot print at all. */
function downloadHtml(html: string, filename: string): string {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Kept alive so the toast's "عرض" link can still open it. Browsers drop it
  // with the document anyway.
  return url
}

/** The full standalone document, for the agent path and the file fallback. */
function receiptDocument(innerHtml: string, styles: string, title: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(
    title,
  )}</title><style>${styles}</style></head><body>${innerHtml}</body></html>`
}

/** Drive the printer from a throwaway hidden iframe. */
function printHtml(
  innerHtml: string,
  styles: string,
  title: string,
  onOutcome?: (outcome: PrintOutcome, fileUrl?: string) => void,
  deliver: "print" | "download" = "print",
): void {
  if (typeof window === "undefined") return
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(
    title,
  )}</title><style>${styles}</style></head><body>${innerHtml}</body></html>`

  const iframe = document.createElement("iframe")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  })
  iframe.setAttribute("aria-hidden", "true")
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  if (!win) {
    iframe.remove()
    return
  }
  const doc = win.document
  doc.open()
  doc.write(html)
  doc.close()

  let fired = false
  const cleanup = () => window.setTimeout(() => iframe.remove(), 800)
  win.onafterprint = cleanup

  const trigger = () => {
    if (fired) return
    fired = true
    // Wait for the logo + barcode images to decode so nothing prints blank.
    const imgs = Array.from(doc.images)
    Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = img.onerror = () => res()
            }),
      ),
    ).then(() => {
      let outcome: PrintOutcome = "printed"
      let fileUrl: string | undefined
      const filename = `${title.replace(/[^\w\u0600-\u06FF -]/g, "")}.html`
      // This counter has no printer (the owner said so in print settings), so
      // do NOT call print(): without Chrome's --kiosk-printing that opens the
      // OS dialog, and asking a cashier to dismiss a dialog on every sale to
      // reach a file is worse than just handing her the file.
      if (deliver === "download") {
        try {
          fileUrl = downloadHtml(html, filename)
          outcome = "downloaded"
        } catch {
          outcome = "unavailable"
        }
        onOutcome?.(outcome, fileUrl)
        window.setTimeout(cleanup, 1_000)
        return
      }
      try {
        if (typeof win.print !== "function") throw new Error("no print support")
        win.focus()
        win.print()
      } catch {
        // This device cannot print at all (WebView, locked-down kiosk). Give
        // the cashier the receipt as a file rather than nothing — the customer
        // is still standing at the counter.
        outcome = "unavailable"
        try {
          fileUrl = downloadHtml(html, filename)
        } catch {
          /* even the download failed — the caller still gets "unavailable" */
        }
      }
      onOutcome?.(outcome, fileUrl)
      // Fallback cleanup for browsers that never fire onafterprint.
      window.setTimeout(cleanup, 60_000)
    })
  }

  if (doc.readyState === "complete") window.setTimeout(trigger, 60)
  else iframe.onload = trigger
}

/**
 * Print a sale receipt. `pharmacyName` should be the tenant's name from /me/;
 * the print settings can override it and supply phone/address/logo.
 */
export function printReceipt(
  data: ReceiptData,
  pharmacyName = "",
  settings?: PrintSettings,
  logoUrl = "",
  onOutcome?: (outcome: PrintOutcome, fileUrl?: string) => void,
): void {
  void receiptDocument // used by the agent path (see deliverReceipt)
  const s = settings ?? loadPrintSettings()
  // Name comes from the account's store (backend); the fallback is the
  // deployment brand so a receipt never prints another product's name.
  // Never a hardcoded/stale value.
  const name = (pharmacyName || "").trim() || "المودة"
  const paper = s.paper === "58" ? 58 : 80
  printHtml(
    receiptBodyHtml(data, name, s, logoUrl),
    baseStyles(paper),
    `فاتورة ${data.receiptCode || data.saleId || ""}`,
    onOutcome,
    s.deliver,
  )
}

/* ── Barcode labels ─────────────────────────────────────────────────── */

export type LabelItem = {
  name: string
  price?: string | number
  barcode?: string | null
}

export type LabelOptions = {
  copies?: number
  paper?: "58" | "80" | "a4"
  /** Columns when printing on an A4 sticker sheet. */
  columns?: number
  showPrice?: boolean
  showName?: boolean
  pharmacyName?: string
}

function labelStyles(opts: Required<Pick<LabelOptions, "paper" | "columns">>): string {
  const onRoll = opts.paper !== "a4"
  const rollMm = opts.paper === "58" ? 58 : 80
  const page = onRoll ? `size: ${rollMm}mm auto; margin: 0;` : `size: A4; margin: 6mm;`
  const labelWidth = onRoll ? `${rollMm - 6}mm` : `calc((100% - ${(opts.columns - 1) * 4}mm) / ${opts.columns})`
  return `
    @page { ${page} }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif; direction: rtl; }
    .sheet { display: flex; flex-wrap: wrap; gap: 4mm; ${onRoll ? "flex-direction: column; align-items: center;" : ""} }
    .label {
      width: ${labelWidth};
      border: ${onRoll ? "0" : "1px dashed #bbb"};
      padding: 2mm; text-align: center;
      page-break-inside: avoid; break-inside: avoid;
    }
    .label .shop { font-size: 9px; color: ${BRAND_INDIGO}; font-weight: 700; }
    .label .nm { font-size: 11px; font-weight: 600; margin: 1px 0; line-height: 1.2;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .label .pr { font-size: 14px; font-weight: 800; color: ${BRAND_INK}; }
    .label svg { display: block; margin: 2px auto 0; max-width: 100%; }
    .label .code { font-size: 9px; letter-spacing: 1px; }
  `
}

/** Print one or more barcode labels (per-med shelf/price tags). */
export function printLabels(items: LabelItem[], opts: LabelOptions = {}): void {
  const s = loadPrintSettings()
  const paper = opts.paper ?? (s.paper === "58" ? "58" : "80")
  const columns = Math.max(1, opts.columns ?? (paper === "a4" ? 3 : 1))
  const copies = Math.max(1, opts.copies ?? 1)
  const showPrice = opts.showPrice ?? true
  const showName = opts.showName ?? true
  const shop = opts.pharmacyName || s.pharmacyName || ""

  const cells: string[] = []
  for (const it of items) {
    const svg = it.barcode
      ? (barcodeSvg(String(it.barcode), { moduleWidth: 1.8, height: 46 }) ?? "")
      : ""
    const label = `
      <div class="label">
        ${shop ? `<div class="shop">${esc(shop)}</div>` : ""}
        ${showName ? `<div class="nm">${esc(it.name)}</div>` : ""}
        ${showPrice && it.price != null ? `<div class="pr">${esc(formatMoney(it.price))}</div>` : ""}
        ${svg ? `${svg}<div class="code">${esc(it.barcode)}</div>` : `<div class="code">— بدون باركود —</div>`}
      </div>`
    for (let i = 0; i < copies; i++) cells.push(label)
  }

  printHtml(
    `<div class="sheet">${cells.join("")}</div>`,
    labelStyles({ paper, columns }),
    "ملصقات باركود",
  )
}

export { DEFAULT_PRINT_SETTINGS }
