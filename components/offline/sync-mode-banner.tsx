"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, CloudOff, DownloadCloud, PauseCircle, UploadCloud, Wifi } from "lucide-react"

import { getSyncMode, onSyncModeChange, SYNC_MODES, type SyncMode } from "@/lib/offline/sync-mode"
import { useModules, hasModule } from "@/lib/modules"
import { onQueueChange, pendingCount } from "@/lib/offline/queue"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const ICON: Record<Exclude<SyncMode, "auto">, typeof Wifi> = {
  wifi: Wifi,
  upload: UploadCloud,
  download: DownloadCloud,
  manual: PauseCircle,
  off: CloudOff,
}

/**
 * Thin top banner reminding the user their sync isn't on full-auto (so they
 * don't forget the app is holding uploads/downloads). Hidden on "auto" and when
 * the offline module isn't enabled. Tapping it opens Settings to change the mode.
 */
export function SyncModeBanner() {
  const { modules } = useModules()
  const offlineOn = modules === null || hasModule(modules, "offline")
  const [mode, setMode] = useState<SyncMode>("auto")
  const [pending, setPending] = useState(0)

  useEffect(() => {
    setMode(getSyncMode())
    return onSyncModeChange(() => setMode(getSyncMode()))
  }, [])
  useEffect(() => {
    void pendingCount().then(setPending)
    return onQueueChange(() => void pendingCount().then(setPending))
  }, [])

  if (!offlineOn || mode === "auto") return null

  const meta = SYNC_MODES.find((m) => m.value === mode)
  const Icon = ICON[mode as Exclude<SyncMode, "auto">] ?? CloudOff
  const danger = mode === "off"

  return (
    <Link
      href="/settings"
      title="تغيير وضع المزامنة"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold transition",
        danger
          ? "bg-destructive/12 text-destructive hover:bg-destructive/20"
          : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>المزامنة: {meta?.label}</span>
      {pending > 0 && (
        <span className="rounded-full bg-black/10 px-1.5 py-0.5 tabular-nums dark:bg-white/15">
          {formatNumber(pending)} بانتظار
        </span>
      )}
      <ChevronLeft className="size-3.5 shrink-0 opacity-70" />
    </Link>
  )
}
