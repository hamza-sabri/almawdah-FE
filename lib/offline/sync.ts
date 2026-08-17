"use client"

import { salesCreate, type Sale } from "@/api/sales"
import {
  listQueuedSales,
  pendingCount,
  removeQueuedSale,
  updateQueuedSale,
} from "@/lib/offline/queue"

export type FlushResult = { synced: number; failed: number; remaining: number }

// Module-level guard so a manual flush + the interval + the online event can't
// run the loop concurrently and double-post.
let inFlight = false

function httpStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status
}

/**
 * Push every queued sale to the server, oldest first. Each carries its
 * `client_uuid`, so a sale that actually landed before the connection dropped
 * is de-duplicated server-side rather than duplicated.
 *
 * - success → removed from the queue; `onSaleSynced` fires (to refresh caches)
 * - 4xx validation (bad payload) → kept + flagged, loop continues past it
 * - network / 5xx / auth → stop; we're still offline or the server is down
 */
export async function flushPendingSales(
  onSaleSynced?: (sale: Sale, clientUuid: string) => void,
): Promise<FlushResult> {
  if (inFlight) return { synced: 0, failed: 0, remaining: await pendingCount() }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: await pendingCount() }
  }

  inFlight = true
  let synced = 0
  let failed = 0
  try {
    const rows = await listQueuedSales()
    for (const row of rows) {
      // A row this fresh is likely a write-ahead entry whose direct POST is
      // still in flight (submit-sale.ts) — let that attempt settle first so
      // the two paths can't interleave remove/update on the same row.
      if (Date.now() - row.createdAt < 5_000) continue
      try {
        const res = await salesCreate(row.payload)
        await removeQueuedSale(row.clientUuid)
        synced += 1
        onSaleSynced?.(res.data, row.clientUuid)
      } catch (e) {
        const status = httpStatus(e)
        if (typeof status === "number" && status >= 400 && status < 500 && status !== 401) {
          // The server rejected the payload itself — keep it, flag it, and move
          // on so one bad sale doesn't block the rest from syncing.
          await updateQueuedSale({
            ...row,
            attempts: row.attempts + 1,
            lastError: e instanceof Error ? e.message : "rejected",
          })
          failed += 1
          continue
        }
        // Network error, server 5xx, or expired auth → stop and retry later.
        break
      }
    }
  } finally {
    inFlight = false
  }
  return { synced, failed, remaining: await pendingCount() }
}
