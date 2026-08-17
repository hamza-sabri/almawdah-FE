"use client"

import type { SalePayload } from "@/api/sales"
import {
  STORE_PENDING_SALES,
  idbCount,
  idbDelete,
  idbGetAll,
  idbPut,
} from "@/lib/offline/idb"

/**
 * A sale captured at the counter while offline (or when the server was
 * unreachable). It carries a stable `clientUuid` used as the server-side
 * idempotency key, so re-sending after a flaky connection can never create a
 * duplicate sale or double-decrement stock (see the backend `client_uuid`
 * field on Sale).
 */
export type QueuedSale = {
  clientUuid: string
  payload: SalePayload
  createdAt: number
  /** For the receipt + the pending-list UI (server is the source of truth). */
  total: number
  discountedTotal: number
  isReturn: boolean
  paymentMethod: "cash" | "debt"
  customerName?: string
  cashierName?: string
  attempts: number
  lastError?: string
}

const CHANGE_EVENT = "pharma-queue-changed"

export function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  }
}

/** Subscribe to queue-size changes (enqueue / synced / failed). */
export function onQueueChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, cb)
  return () => window.removeEventListener(CHANGE_EVENT, cb)
}

export async function enqueueSale(
  sale: Omit<QueuedSale, "attempts">,
): Promise<void> {
  await idbPut(STORE_PENDING_SALES, { ...sale, attempts: 0 })
  announce()
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const rows = await idbGetAll<QueuedSale>(STORE_PENDING_SALES)
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeQueuedSale(clientUuid: string): Promise<void> {
  await idbDelete(STORE_PENDING_SALES, clientUuid)
  announce()
}

export async function updateQueuedSale(sale: QueuedSale): Promise<void> {
  await idbPut(STORE_PENDING_SALES, sale)
  announce()
}

export async function pendingCount(): Promise<number> {
  try {
    return await idbCount(STORE_PENDING_SALES)
  } catch {
    return 0
  }
}
