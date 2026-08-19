"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

/**
 * "A new version is available — tap to update."
 *
 * Replaces an automatic reload. The service worker used to call skipWaiting()
 * and SwRegister reloaded the page the moment a new build activated — which on
 * a till means the screen can blank mid-sale, while a customer is standing
 * there. A cart survives (it is in localStorage), but the cashier does not
 * know that, and an app that reloads itself unprompted is an app they stop
 * trusting.
 *
 * So the new build waits. The cashier finishes what they are doing, taps once,
 * and the page reloads deliberately.
 */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    let cancelled = false

    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return
        // Already waiting when this tab opened (deployed while it was closed).
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaiting(reg.waiting)
        }
        reg.addEventListener("updatefound", () => {
          const fresh = reg.installing
          if (!fresh) return
          fresh.addEventListener("statechange", () => {
            // "installed" WITH a controller means an update, not a first install.
            if (fresh.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(fresh)
            }
          })
        })
        // Deploys are irregular, so poll rather than wait for a navigation.
        // Five minutes is far below any realistic deploy cadence and costs one
        // conditional request.
        const timer = window.setInterval(
          () => void reg.update().catch(() => {}),
          5 * 60_000,
        )
        return () => window.clearInterval(timer)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (!waiting) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed inset-x-0 bottom-4 z-[90] mx-auto w-fit px-4 duration-300">
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true)
          // Tell the waiting worker to take over; SwRegister's
          // controllerchange listener does the reload.
          waiting.postMessage({ type: "SKIP_WAITING" })
          // Belt and braces: reload anyway shortly after, in case the message
          // is missed. A till that says "updating" and never does is worse
          // than a hard reload.
          window.setTimeout(() => window.location.reload(), 1200)
        }}
        className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110 active:scale-95 disabled:opacity-70"
      >
        <RefreshCw className={reloading ? "size-4 animate-spin" : "size-4"} />
        {reloading ? "جارٍ التحديث…" : "يوجد تحديث جديد — اضغط للتحديث"}
      </button>
    </div>
  )
}
