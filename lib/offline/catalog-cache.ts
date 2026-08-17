"use client"

import type { CatalogMed, QuickCustomer } from "@/api/sales"
import { STORE_KV, idbDelete, idbGet, idbPut } from "@/lib/offline/idb"

/**
 * Durable cache of the two lists the POS needs to keep selling offline:
 *   - the whole product catalogue (name + barcode + price + stock), and
 *   - the customers quick-list (for debt sales).
 *
 * The live app already holds these in memory via React Query; we mirror them
 * to IndexedDB so they survive a reload with no network — the cashier can
 * search by name, scan a barcode and take cash while the internet is down.
 *
 * IMPORTANT — every entry is stamped with the store id it belongs to. On
 * read we refuse to serve a catalogue stamped for a DIFFERENT store (an
 * account-switch on the same browser, or a legacy un-stamped cache). Without
 * this guard the POS could show one store's products (with ids that don't
 * exist for the current tenant) and a checkout fails with "invalid pk".
 */

const KEY_CATALOG = "pos_catalog"
const KEY_CUSTOMERS = "customers_quick"

type PharmacyId = string | number | null | undefined
type Cached<T> = { at: number; pid?: string | number | null; rows: T[] }

/** True when a cached entry belongs to the store we're asking for. */
function belongsTo(cachedPid: unknown, expect: PharmacyId): boolean {
  if (expect == null) return true // caller didn't scope — legacy behaviour
  return cachedPid != null && String(cachedPid) === String(expect)
}

export async function cacheCatalog(
  rows: CatalogMed[],
  pid: PharmacyId,
): Promise<void> {
  try {
    await idbPut(STORE_KV, { at: Date.now(), pid: pid ?? null, rows }, KEY_CATALOG)
  } catch {
    /* private mode / quota — in-memory copy still serves this session */
  }
}

export async function readCachedCatalog(
  pid?: PharmacyId,
): Promise<CatalogMed[] | null> {
  try {
    const v = await idbGet<Cached<CatalogMed>>(STORE_KV, KEY_CATALOG)
    if (!v) return null
    if (!belongsTo(v.pid, pid)) return null // wrong / unknown tenant → refetch
    return v.rows ?? null
  } catch {
    return null
  }
}

export async function cacheCustomers(
  rows: QuickCustomer[],
  pid: PharmacyId,
): Promise<void> {
  try {
    await idbPut(STORE_KV, { at: Date.now(), pid: pid ?? null, rows }, KEY_CUSTOMERS)
  } catch {
    /* ignore */
  }
}

export async function readCachedCustomers(
  pid?: PharmacyId,
): Promise<QuickCustomer[] | null> {
  try {
    const v = await idbGet<Cached<QuickCustomer>>(STORE_KV, KEY_CUSTOMERS)
    if (!v) return null
    if (!belongsTo(v.pid, pid)) return null
    return v.rows ?? null
  } catch {
    return null
  }
}

/** Wipe the offline catalogue/customers cache — call on login & logout so a
 *  new account never inherits the previous store's data. */
export async function clearOfflineCaches(): Promise<void> {
  await idbDelete(STORE_KV, KEY_CATALOG).catch(() => {})
  await idbDelete(STORE_KV, KEY_CUSTOMERS).catch(() => {})
}
