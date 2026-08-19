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
  if (!status.available) {
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
  const res = await agentPrint(toBase64(bytes), name)
  if (res.ok) return { outcome: "agent", printer: status.printer }
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
