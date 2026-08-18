"use client"

import { toast } from "sonner"

import { API_BASE } from "@/api/http"
import { getAccessToken } from "@/lib/tokens"

/**
 * Download the full data export: one xlsx, two sheets (products + sales).
 *
 * There is deliberately no chooser. The owner wants a backup or something to
 * hand the accountant — asking "which half?" only adds a click and a decision
 * that has no wrong answer.
 *
 * The request is authenticated, so it cannot be a plain <a href> — the Bearer
 * token has to be attached. Fetch it, then hand the browser a blob URL.
 */
export async function downloadDataExport(): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/api/v1/export/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "التصدير متاح لمالك المتجر فقط."
        : res.status === 401
          ? "انتهت الجلسة — سجّل الدخول من جديد."
          : `تعذر التصدير (${res.status}).`,
    )
  }

  const products = res.headers.get("X-Product-Count")
  const sales = res.headers.get("X-Sale-Count")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "almawdah.xlsx"
  a.click()
  URL.revokeObjectURL(url)

  toast.success(
    products && sales
      ? `تم تصدير ${Number(products).toLocaleString("ar")} منتج و ${Number(sales).toLocaleString("ar")} عملية بيع`
      : "تم التصدير",
  )
}
