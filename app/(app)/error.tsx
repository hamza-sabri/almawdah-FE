"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"

/**
 * App-section error boundary with SELF-HEALING for stale deployments.
 *
 * Right after a deploy, an open tab (or the service worker's cached shell)
 * can hold JS chunks from the previous build — the first client-side
 * navigation then throws (chunk 404 / stale code) and used to strand the
 * user on "This page couldn't load" until they refreshed manually. Here we
 * do that refresh FOR them, once per session, which pulls the fresh build.
 * Real recurring errors still render the retry UI instead of reload-looping.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const KEY = "pharma_auto_reloaded"
    try {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, String(Date.now()))
        window.location.reload()
        return
      }
      // Allow another auto-recovery after 10 minutes (next deploy).
      const last = Number(sessionStorage.getItem(KEY)) || 0
      if (Date.now() - last > 10 * 60_000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        window.location.reload()
      }
    } catch {
      // Storage unavailable — fall through to the manual UI.
    }
  }, [error])

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-heading text-lg font-bold">حدث خطأ غير متوقع</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        جرّب التحديث — إن تكرر الخطأ أخبرنا وسنصلحه فوراً.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.removeItem("pharma_auto_reloaded")
          } catch {
            /* ignore */
          }
          reset()
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
      >
        <RotateCcw className="size-4" />
        إعادة المحاولة
      </button>
    </div>
  )
}
