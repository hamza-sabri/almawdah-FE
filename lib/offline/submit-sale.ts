"use client"

import { salesCreate, type Sale, type SalePayload } from "@/api/sales"
import {
  enqueueSale,
  removeQueuedSale,
  uuid,
  type QueuedSale,
} from "@/lib/offline/queue"
import { isOfflineEnabled } from "@/lib/offline/enabled"
import { canAutoUpload } from "@/lib/offline/sync-mode"

export type SubmitMeta = {
  total: number
  discountedTotal: number
  isReturn: boolean
  paymentMethod: "cash" | "debt"
  customerName?: string
  cashierName?: string
}

export type SubmitResult =
  | { status: "synced"; sale: Sale; clientUuid: string }
  | { status: "queued"; queued: QueuedSale }

/** A thrown error that carries an HTTP status = the server answered (so the
 *  payload reached it and was rejected on its merits — don't queue that). A
 *  4xx (other than auth) is a real validation problem the cashier must see. */
function isHardValidationError(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401
}

/**
 * Commit a checkout — WRITE-AHEAD when the offline tier is enabled.
 *
 * The durability contract (the owner's requirement, verbatim): a sale leaves
 * the local queue ONLY after the server confirms it. To guarantee that even
 * across a crash/refresh mid-request, offline-enabled tiers persist the sale
 * to IndexedDB BEFORE the network attempt:
 *
 *   1. enqueue (durable, with the idempotency client_uuid)
 *   2. try the POST
 *   3. 2xx  → remove from queue, return "synced"
 *      4xx  → remove from queue, re-throw (a validation error the cashier
 *             must fix — retrying the same payload can never succeed)
 *      else → keep queued, return "queued" (the sync loop retries; the
 *             client_uuid makes any ambiguous double-send safe server-side)
 *
 * Tiers without the offline module keep the old behavior: direct POST,
 * errors surface immediately, nothing is silently deferred.
 */
export async function submitSale(
  payload: SalePayload,
  meta: SubmitMeta,
): Promise<SubmitResult> {
  const clientUuid = payload.client_uuid ?? uuid()
  const body: SalePayload = { ...payload, client_uuid: clientUuid }

  const record = (lastError?: string): Omit<QueuedSale, "attempts"> => ({
    clientUuid,
    payload: body,
    createdAt: Date.now(),
    total: meta.total,
    discountedTotal: meta.discountedTotal,
    isReturn: meta.isReturn,
    paymentMethod: meta.paymentMethod,
    customerName: meta.customerName,
    cashierName: meta.cashierName,
    lastError,
  })

  const offlineAllowed = isOfflineEnabled()

  if (!offlineAllowed) {
    // Non-offline tiers: direct POST, no queue, errors surface immediately.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("العمل بدون إنترنت متاح في الباقة الأعلى فقط.")
    }
    const res = await salesCreate(body)
    return { status: "synced", sale: res.data, clientUuid }
  }

  // WRITE-AHEAD: the sale is durable before we talk to the network.
  const queued = record()
  await enqueueSale(queued)

  // Skip the immediate POST when we're offline OR the user's sync mode has the
  // Upload valve closed (Offline / Manual / Download-only / Wi-Fi-on-weak). The
  // sale is already durably queued; it uploads on the next allowed auto-sync or
  // when the cashier taps "Sync now" — so "off" really does stay local.
  const offlineNow = typeof navigator !== "undefined" && navigator.onLine === false
  if (offlineNow || !canAutoUpload()) {
    return { status: "queued", queued: { ...queued, attempts: 0 } }
  }

  try {
    const res = await salesCreate(body)
    await removeQueuedSale(clientUuid) // confirmed by the server — safe to clear
    return { status: "synced", sale: res.data, clientUuid }
  } catch (e) {
    if (isHardValidationError(e)) {
      // The server READ the payload and rejected it on its merits: keeping it
      // queued would retry a permanently-bad sale forever.
      await removeQueuedSale(clientUuid)
      throw e
    }
    // Network / 5xx / auth: stays queued (already durable), syncs later.
    return { status: "queued", queued: { ...queued, attempts: 0 } }
  }
}
