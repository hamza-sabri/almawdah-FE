"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

/**
 * A full-screen red flash when a scan finds nothing.
 *
 * The problem this solves is physical, not visual. The barcode gun has its own
 * speaker and chirps on every successful READ — including a barcode this shop
 * has never stocked. The cashier hears the gun say yes, assumes the item is on
 * the bill, and moves on. Goods walk out unpaid.
 *
 * So the app's "no" has to be bigger than the gun's "yes": the whole screen
 * goes red for a moment, with the code that failed. It is deliberately
 * impossible to miss and deliberately brief — it never blocks the next scan,
 * because a cashier with a queue will not click a dialog away.
 */
export function useScanAlert() {
  const [failed, setFailed] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const flashNotFound = useCallback((code?: string) => {
    setFailed(code || "")
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (failed === null) return
    const t = window.setTimeout(() => setFailed(null), 1600)
    return () => window.clearTimeout(t)
  }, [failed, nonce])

  const overlay =
    failed === null ? null : (
      <div
        key={nonce}
        // pointer-events-none: the cashier can keep scanning THROUGH the
        // warning. Anything that has to be dismissed gets dismissed reflexively.
        className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="animate-in fade-in absolute inset-0 bg-destructive/35 duration-75" />
        <div className="animate-in zoom-in-95 fade-in relative flex max-w-md flex-col items-center gap-2 rounded-3xl bg-destructive px-8 py-6 text-center text-white shadow-2xl duration-100">
          <AlertTriangle className="size-10" />
          <p className="font-heading text-2xl font-bold">لم يُضَف!</p>
          <p className="text-sm text-white/90">
            هذا الباركود غير موجود في المتجر
          </p>
          {failed && (
            <p className="mt-1 rounded-lg bg-black/20 px-3 py-1 font-mono text-sm" dir="ltr">
              {failed}
            </p>
          )}
        </div>
      </div>
    )

  return { flashNotFound, scanAlertOverlay: overlay }
}
