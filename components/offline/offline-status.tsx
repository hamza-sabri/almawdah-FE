"use client"

import { CloudOff, Loader2, RefreshCw, UploadCloud } from "lucide-react"

import { useOfflineSync } from "@/hooks/use-offline-sync"
import { useModules } from "@/lib/modules"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The POS resilience indicator. Mount ONCE in the app shell — it also owns the
 * background sync loop (useOfflineSync). Stays out of the way when everything
 * is online and empty; surfaces a clear pill when offline or while sales are
 * waiting to sync, with a manual retry.
 */
export function OfflineStatus() {
  const { modules } = useModules()
  const { pending, syncing, online, flush } = useOfflineSync()

  // Offline mode is a top-tier capability.
  const enabled = modules === null || modules.has("offline")
  if (!enabled) return null

  // All good and nothing queued → render nothing.
  if (online && pending === 0 && !syncing) return null

  let tone: "danger" | "warn" | "info" = "info"
  let icon = <UploadCloud className="size-4" />
  let text = ""

  if (!online) {
    tone = "danger"
    icon = <CloudOff className="size-4" />
    text =
      pending > 0
        ? `غير متصل — ${formatNumber(pending)} فاتورة محفوظة`
        : "غير متصل — البيع يعمل والفواتير تُحفظ"
  } else if (syncing) {
    tone = "info"
    icon = <Loader2 className="size-4 animate-spin" />
    text = `جارٍ المزامنة… ${pending > 0 ? formatNumber(pending) : ""}`.trim()
  } else if (pending > 0) {
    tone = "warn"
    icon = <UploadCloud className="size-4" />
    text = `${formatNumber(pending)} فاتورة بانتظار المزامنة`
  }

  const toneCls =
    tone === "danger"
      ? "bg-destructive text-white"
      : tone === "warn"
        ? "bg-amber-500 text-white"
        : "bg-ink text-white"

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-3 lg:bottom-4 lg:justify-start lg:ps-6">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg ring-1 ring-black/10 animate-in fade-in slide-in-from-bottom-2",
          toneCls,
        )}
        role="status"
        aria-live="polite"
      >
        {icon}
        <span>{text}</span>
        {online && pending > 0 && !syncing && (
          <button
            type="button"
            onClick={() => void flush()}
            className="ms-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 transition hover:bg-white/30"
          >
            <RefreshCw className="size-3" />
            إعادة
          </button>
        )}
      </div>
    </div>
  )
}
