"use client"

/**
 * Minimal promise wrapper around IndexedDB — no dependency. One database holds
 * everything the POS needs to survive an internet/power cut in Qalqilya:
 *
 *  - `pending_sales`  queued checkouts waiting to sync (keyed by client UUID)
 *  - `kv`             cached blobs (the product catalogue + customers list) so
 *                     search & barcode scans keep working offline and across
 *                     reloads.
 *
 * IndexedDB (not localStorage) because the catalogue can be thousands of rows
 * and the queue must be transactional and survive a tab crash.
 */

const DB_NAME = "pharma_offline_v1"
const DB_VERSION = 1
export const STORE_PENDING_SALES = "pending_sales"
export const STORE_KV = "kv"

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PENDING_SALES)) {
        db.createObjectStore(STORE_PENDING_SALES, { keyPath: "clientUuid" })
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"))
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        t.oncomplete = () => resolve(req.result)
        t.onabort = t.onerror = () =>
          reject(t.error ?? req.error ?? new Error("idb tx failed"))
      }),
  )
}

export function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>)
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>)
}

export function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> {
  return tx<IDBValidKey>(store, "readwrite", (s) =>
    key !== undefined ? s.put(value, key) : s.put(value),
  )
}

export function idbDelete(store: string, key: IDBValidKey): Promise<undefined> {
  return tx<undefined>(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>)
}

export function idbCount(store: string): Promise<number> {
  return tx<number>(store, "readonly", (s) => s.count())
}
