"use client"

/**
 * The receipt, drawn onto a canvas in printer dots.
 *
 * Why draw it rather than convert the HTML: the printer needs an exact
 * bitmap, `width` dots across, where a barcode module lands on a whole number
 * of dots. HTML→canvas converters give you neither — they rasterise at CSS
 * pixel scale and the barcode comes out with fractional bars that a scanner
 * reads as a different number than the digits printed underneath it. Here the
 * layout is a receipt: a header, some rows, a table, a total, a barcode. It is
 * cheaper to draw it than to fight a converter.
 *
 * Arabic is still the browser's own text engine (`fillText`), so shaping and
 * RTL are correct without us touching a code page.
 */

import { barcodeModules } from "@/lib/print/barcode"
import { formatMoney } from "@/lib/format"
import { badgeLabels, type ReceiptData } from "@/lib/print/receipt"

const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif'

type Ctx = CanvasRenderingContext2D

function dashed(ctx: Ctx, y: number, w: number, pad: number) {
  ctx.save()
  ctx.setLineDash([6, 5])
  ctx.lineWidth = 2
  ctx.strokeStyle = "#000"
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(w - pad, y)
  ctx.stroke()
  ctx.restore()
}

function solid(ctx: Ctx, y: number, w: number, pad: number) {
  ctx.fillStyle = "#000"
  ctx.fillRect(pad, y, w - pad * 2, 2)
}

/**
 * Wrap on WORD boundaries, then hard-break a single word too long to fit.
 * Product names here run to "بازيلاء مع جزر فتيان 500 غم" — truncating them
 * would leave the customer unable to tell two similar lines apart.
 */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const word of text.split(/\s+/)) {
    if (!out.length) {
      out.push(word)
      continue
    }
    const merged = out[out.length - 1] + " " + word
    if (ctx.measureText(merged).width <= maxWidth) out[out.length - 1] = merged
    else out.push(word)
  }
  const fitted: string[] = []
  for (const line of out) {
    if (ctx.measureText(line).width <= maxWidth) {
      fitted.push(line)
      continue
    }
    let cur = ""
    for (const ch of line) {
      if (ctx.measureText(cur + ch).width > maxWidth && cur) {
        fitted.push(cur)
        cur = ch
      } else cur += ch
    }
    if (cur) fitted.push(cur)
  }
  return fitted
}

function fmtDate(value?: string | Date): string {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export type CanvasReceiptOptions = {
  /** Printable width in DOTS. Must be a multiple of 8. */
  width: number
  storeName: string
  phone?: string
  address?: string
  barcode?: boolean
}

/**
 * Draw the receipt and return the canvas. Height grows with the item count —
 * a roll has no page.
 */
export function renderReceiptCanvas(
  data: ReceiptData,
  opts: CanvasReceiptOptions,
): HTMLCanvasElement {
  const W = opts.width
  const pad = Math.round(W * 0.03)
  const inner = W - pad * 2
  // Scale every size off the roll width so 58mm and 80mm both look right.
  const u = W / 576
  const S = (n: number) => Math.round(n * u)

  // Two passes: measure with a throwaway context, then draw at the real
  // height. A receipt's height is not known until the names are wrapped.
  const measure = document.createElement("canvas").getContext("2d")!
  const bodyFont = `${S(20)}px ${FONT}`

  // Column geometry, decided ONCE and shared by the measure pass and the draw
  // pass. Getting this wrong is not cosmetic: at 0.52*inner the name ran right
  // up to the centre of the quantity column and a long one ("بازيلاء مع جزر
  // فتيان 500 غم معلبة") printed the quantity digit on top of the last word.
  const qtyX = W / 2 - S(10)
  const gutter = S(34)
  const nameW = W - pad - (qtyX + gutter)
  measure.font = `600 ${bodyFont}`
  const wrapped = data.items.map((it) => wrap(measure, it.name, nameW))

  // Built here rather than at draw time so the height below can COUNT them.
  // These two lists used to be measured with fixed guesses ("four meta rows"),
  // which had no slack left the moment a fifth was added — and an under-tall
  // canvas silently clips the bottom of a receipt.
  const badges = badgeLabels(data)
  const code = data.receiptCode || (data.saleId != null ? String(data.saleId) : "")
  const meta: Array<[string, string]> = [
    [data.isReturn ? "إرجاع رقم" : "فاتورة رقم", code || "—"],
    ["التاريخ", fmtDate(data.createdAt)],
    ["الدفع", data.paymentMethod === "debt" ? "دين (آجل)" : "نقدي"],
  ]
  if (data.customerName) meta.push(["الزبون", data.customerName])
  if (data.cashierName) meta.push(["الكاشير", data.cashierName])

  let h = S(24)
  h += S(46) // store name
  if (opts.phone) h += S(26)
  if (opts.address) h += S(26)
  h += S(20)
  h += badges.length * S(44)
  h += meta.length * S(28) + S(26)
  h += S(34) // table head
  for (const lines of wrapped) h += lines.length * S(26) + S(24)
  h += S(20) + S(32) // rule + total
  const hasDiscount = data.total - data.discountedTotal > 0.001
  if (hasDiscount) h += S(30)
  h += S(48) // grand total
  const bcH = S(80)
  if (opts.barcode !== false) h += bcH + S(60)
  h += S(40)

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = Math.ceil(h)
  const ctx = canvas.getContext("2d")!
  // The raster is 1-bit: anything not drawn must be white, not transparent.
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#000"
  ctx.textBaseline = "alphabetic"
  // RTL so Arabic punctuation and digits sit correctly inside a line; the
  // per-cell alignment below is set explicitly, so this only affects shaping.
  ctx.direction = "rtl"

  let y = S(24)

  // ── header ──────────────────────────────────────────────────────────
  ctx.textAlign = "center"
  ctx.font = `800 ${S(34)}px ${FONT}`
  ctx.fillText(opts.storeName, W / 2, y + S(34))
  y += S(46)
  ctx.font = `${S(18)}px ${FONT}`
  if (opts.phone) {
    ctx.fillText(opts.phone, W / 2, y + S(18))
    y += S(26)
  }
  if (opts.address) {
    ctx.fillText(opts.address, W / 2, y + S(18))
    y += S(26)
  }
  y += S(12)
  dashed(ctx, y, W, pad)
  y += S(20)

  for (const label of badges) {
    ctx.font = `700 ${S(22)}px ${FONT}`
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.strokeRect(pad + S(40), y, inner - S(80), S(34))
    ctx.textAlign = "center"
    ctx.fillText(label, W / 2, y + S(25))
    y += S(44)
  }

  // ── meta ────────────────────────────────────────────────────────────
  ctx.font = `${S(19)}px ${FONT}`
  for (const [k, v] of meta) {
    ctx.textAlign = "right"
    ctx.fillText(k, W - pad, y + S(19))
    ctx.textAlign = "left"
    ctx.fillText(v, pad, y + S(19))
    y += S(28)
  }
  y += S(10)
  dashed(ctx, y, W, pad)
  y += S(22)

  // ── items ───────────────────────────────────────────────────────────
  ctx.font = `700 ${S(19)}px ${FONT}`
  ctx.textAlign = "right"
  ctx.fillText("الصنف", W - pad, y)
  ctx.textAlign = "center"
  ctx.fillText("كمية", qtyX, y)
  ctx.textAlign = "left"
  ctx.fillText("المجموع", pad, y)
  y += S(8)
  solid(ctx, y, W, pad)
  y += S(26)

  data.items.forEach((it, i) => {
    const unit = Number(it.unitPrice) || 0
    const line = it.lineTotal != null ? Number(it.lineTotal) : unit * it.quantity
    const top = y
    ctx.font = `600 ${S(20)}px ${FONT}`
    ctx.textAlign = "right"
    for (const l of wrapped[i]) {
      ctx.fillText(l, W - pad, y)
      y += S(26)
    }
    ctx.font = `${S(17)}px ${FONT}`
    ctx.fillText(formatMoney(unit), W - pad, y)
    ctx.font = `${S(19)}px ${FONT}`
    ctx.textAlign = "center"
    ctx.fillText(String(it.quantity), qtyX, top)
    ctx.textAlign = "left"
    ctx.fillText(formatMoney(line), pad, top)
    y += S(24)
  })

  dashed(ctx, y, W, pad)
  y += S(28)

  // ── totals ──────────────────────────────────────────────────────────
  ctx.font = `${S(20)}px ${FONT}`
  ctx.textAlign = "right"
  ctx.fillText("الإجمالي", W - pad, y)
  ctx.textAlign = "left"
  ctx.fillText(formatMoney(data.total), pad, y)
  y += S(30)
  if (hasDiscount) {
    ctx.textAlign = "right"
    ctx.fillText("الخصم", W - pad, y)
    ctx.textAlign = "left"
    ctx.direction = "ltr"
    ctx.fillText("- " + formatMoney(data.total - data.discountedTotal), pad, y)
    ctx.direction = "rtl"
    y += S(30)
  }
  solid(ctx, y - S(18), W, pad)
  ctx.font = `800 ${S(27)}px ${FONT}`
  ctx.textAlign = "right"
  ctx.fillText(data.isReturn ? "المبلغ المُعاد" : "المطلوب", W - pad, y + S(14))
  ctx.textAlign = "left"
  ctx.fillText(formatMoney(data.discountedTotal), pad, y + S(14))
  y += S(48)

  // ── barcode ─────────────────────────────────────────────────────────
  if (opts.barcode !== false && code) {
    const runs = barcodeModules(code)
    if (runs) {
      const modules = runs.reduce((a, b) => a + b, 0)
      const quiet = 10
      // WHOLE dots per module. A fractional module is the single most common
      // reason a printed barcode scans as the wrong number: the rounding drifts
      // across the symbol until a bar is a dot too wide.
      const dotsPerModule = Math.max(
        2,
        Math.floor((inner - quiet * 2) / modules),
      )
      const barsW = modules * dotsPerModule
      let x = Math.round((W - barsW) / 2)
      ctx.fillStyle = "#000"
      runs.forEach((run, i) => {
        const w = run * dotsPerModule
        if (i % 2 === 0) ctx.fillRect(x, y, w, bcH)
        x += w
      })
      y += bcH + S(26)
      ctx.font = `${S(19)}px ${FONT}`
      ctx.textAlign = "center"
      ctx.direction = "ltr"
      ctx.fillText(code.split("").join(" "), W / 2, y)
      ctx.direction = "rtl"
      y += S(20)
    }
  }

  return canvas
}
