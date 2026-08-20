"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { useOnline } from "@/hooks/use-online"
import { onQueueChange, pendingCount } from "@/lib/offline/queue"
import { flushPendingSales } from "@/lib/offline/sync"
import { canAutoUpload } from "@/lib/offline/sync-mode"
import { SALE_AFFECTED_KEYS } from "@/lib/sale-queries"

const RETRY_MS = 20_000

// Query keys touched by a synced sale. Shared with the checkout, the void,
// the wipe and the revision restore — this used to be a hand-kept copy that
// drifted out of step with them.
const AFFECTED_KEYS = SALE_AFFECTED_KEYS

/**
 * Owns the offline-sale sync loop. Mount ONCE (see OfflineStatus in the app
 * layout). Flushes the queue when connectivity returns, on window focus, and
 * on a slow interval while anything is pending; exposes the live counts for
 * the reconnecting UX.
 */
export function useOfflineSync() {
  const online = useOnline()
  const qc = useQueryClient()
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const busy = useRef(false)

  const refreshCount = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  const flush = useCallback(async () => {
    if (busy.current) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return
    busy.current = true
    setSyncing(true)
    let synced = 0
    try {
      const res = await flushPendingSales(() => {
        synced += 1
      })
      setPending(res.remaining)
    } finally {
      busy.current = false
      setSyncing(false)
    }
    if (synced > 0) {
      for (const key of AFFECTED_KEYS) qc.invalidateQueries({ queryKey: key })
    }
  }, [qc])

  // Auto (background) sync respects the user's Upload valve; the manual
  // "Sync now" button calls flush() directly and always runs.
  const autoFlush = useCallback(async () => {
    if (!canAutoUpload()) return
    await flush()
  }, [flush])

  // Live count: initial + whenever the queue changes (enqueue / synced).
  useEffect(() => {
    void refreshCount()
    return onQueueChange(refreshCount)
  }, [refreshCount])

  // Flush when we (re)gain connectivity (respecting the sync mode).
  useEffect(() => {
    if (online) void autoFlush()
  }, [online, autoFlush])

  // Flush on focus and on a slow interval while pending.
  useEffect(() => {
    const onFocus = () => {
      if (typeof navigator === "undefined" || navigator.onLine) void autoFlush()
    }
    window.addEventListener("focus", onFocus)
    const id = window.setInterval(() => {
      if (typeof navigator === "undefined" || navigator.onLine) void autoFlush()
    }, RETRY_MS)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.clearInterval(id)
    }
  }, [autoFlush])

  return { pending, syncing, online, flush }
}
