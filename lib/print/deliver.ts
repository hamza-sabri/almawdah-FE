"use client"

/**
 * One entry point for "give the customer their receipt", in the order that
 * actually serves a shop:
 *
 *   1. the local print agent  → paper, no dialog, nothing for the cashier to do
 *   2. the browser's printer  → the OS dialog (only if the owner chose it)
 *   3. a downloaded file      → so a sale is never blocked by a printer
 *
 * The agent is tried first because it is the only path that is silent AND can
 * truthfully report "there is no printer". Everything below it is a fallback,
 * and every fallback still ends with the customer holding something.
 */

import { toast } from "sonner"

import { agentPrint, agentStatus } from "@/lib/print/agent"
import { canvasToEscPos, toBase64, DOTS } from "@/lib/print/escpos"
import { renderReceiptCanvas } from "@/lib/print/receipt-canvas"
import { printReceipt, type PrintOutcome, type ReceiptData } from "@/lib/print/receipt"
import type { PrintSettings } from "@/lib/print/settings"

export type DeliverResult = {
  outcome: PrintOutcome
  /** Set when the receipt was saved as a file. */
  fileUrl?: string
  /** The printer the agent used, for the toast. */
  printer?: string
  detail?: string
}

/**
 * Render the receipt as the printer's own bitmap and send it to the agent.
 *
 * A raster, not text: text would mean picking an Arabic code page, hoping this
 * printer has it, and shaping the letters ourselves — three ways to print
 * gibberish in a language we would not notice was wrong. The browser draws
 * Arabic correctly; we send what it drew.
 */
async function viaAgent(
  data: ReceiptData,
  settings: PrintSettings,
  storeName: string,
): Promise<DeliverResult | null> {
  const status = await agentStatus()
  // A chosen printer overrides "there is no default" — the till may have no
  // Windows default at all while still having the receipt printer installed.
  if (!status.available && !(status.reason === "no-printer" && settings.printerName)) {
    // No agent at all → fall through to the browser. No PRINTER, though, is a
    // real answer: paper is not coming out of this machine today.
    return status.reason === "no-printer"
      ? { outcome: "unavailable", detail: status.detail }
      : null
  }
  const width = DOTS[settings.paper === "58" ? "58" : "80"]
  const canvas = renderReceiptCanvas(data, {
    width,
    storeName,
    phone: settings.phone || undefined,
    address: settings.address || undefined,
    barcode: settings.receiptBarcode,
  })
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const bytes = canvasToEscPos(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
  )
  const name = `فاتورة ${data.receiptCode || data.saleId || ""}`
  const res = await agentPrint(toBase64(bytes), name, settings.printerName)
  if (res.ok) {
    // Name the device that actually took the job — a cashier who sees
    // "Microsoft Print to PDF" here knows instantly why no paper came out.
    const used =
      settings.printerName ||
      (status.available ? status.printer : "") ||
      undefined
    return { outcome: "agent", printer: used }
  }
  return { outcome: "unavailable", detail: res.detail }
}

export async function deliverReceipt(
  data: ReceiptData,
  storeName: string,
  settings: PrintSettings,
  logoUrl = "",
): Promise<DeliverResult> {
  try {
    const viaLocal = await viaAgent(data, settings, storeName)
    if (viaLocal?.outcome === "agent") return viaLocal
    if (viaLocal?.outcome === "unavailable") {
      // The agent is there and says there is no printer. Skip the browser
      // dialog entirely — it would only offer to print to the printer that
      // does not exist — and hand over the file.
      return await new Promise<DeliverResult>((resolve) => {
        printReceipt(
          data,
          storeName,
          { ...settings, deliver: "download" },
          logoUrl,
          (outcome, fileUrl) => resolve({ outcome, fileUrl, detail: viaLocal.detail }),
        )
      })
    }
  } catch {
    // A broken agent must never block a sale.
  }
  return await new Promise<DeliverResult>((resolve) => {
    printReceipt(data, storeName, settings, logoUrl, (outcome, fileUrl) =>
      resolve({ outcome, fileUrl }),
    )
  })
}

/**
 * How a delivery result reads to a cashier.
 *
 * Shared so the wording cannot drift between the checkout toast (which folds
 * this into the sale's own toast) and the standalone reprints. Three call
 * sites used to bypass all of this and open the browser's print dialog
 * directly — the exact thing the print agent exists to avoid.
 */
export function describeDelivery(r: DeliverResult): {
  tone: "ok" | "warn"
  description: string
  duration: number
} {
  switch (r.outcome) {
    case "agent":
    case "printed":
      return { tone: "ok", description: "طُبعت الفاتورة", duration: 3500 }
    case "downloaded":
      return { tone: "ok", description: "نُزّلت الفاتورة كملف", duration: 5000 }
    default:
      return {
        tone: "warn",
        description: r.detail
          ? `لا توجد طابعة — نُزّلت الفاتورة (${r.detail})`
          : "لا توجد طابعة — نُزّلت الفاتورة",
        duration: 7000,
      }
  }
}

/**
 * Deliver a receipt and say what happened, in one call.
 *
 * For every print that is NOT part of a checkout — reprinting from history,
 * the settings preview. A checkout has its own toast to fold the result into
 * (see the POS), so it uses `deliverReceipt` + `describeDelivery` directly.
 */
export async function deliverAndToast(
  data: ReceiptData,
  storeName: string,
  settings: PrintSettings,
  logoUrl = "",
  headline = "الفاتورة",
): Promise<DeliverResult> {
  const r = await deliverReceipt(data, storeName, settings, logoUrl)
  const d = describeDelivery(r)
  const action = r.fileUrl
    ? { label: "عرض", onClick: () => window.open(r.fileUrl!, "_blank") }
    : undefined
  const show = d.tone === "ok" ? toast.success : toast.warning
  show(headline, { description: d.description, duration: d.duration, action })
  return r
}
