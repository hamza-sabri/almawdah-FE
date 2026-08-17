"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  catalogVersion,
  posCatalog,
  type CatalogMed,
  type CatalogVariant,
} from "@/api/sales"
import { cacheCatalog, readCachedCatalog } from "@/lib/offline/catalog-cache"
import { useMe } from "@/hooks/use-me"
import { getPharmacySlug } from "@/lib/site"

export type ScanHit = { med: CatalogMed; variant: CatalogVariant | null }

/**
 * The entire catalogue held client-side so barcode scans resolve INSTANTLY —
 * no network round-trip between the beep and the item landing in the cart.
 * Refreshed in the background; server side is Redis-cached and invalidated
 * on any product/stock change.
 *
 * Offline-durable: the last catalogue is mirrored to IndexedDB, so after a
 * reload with no internet the cashier can still search by name and scan
 * barcodes. On reconnect the network copy overwrites the cache.
 */
export function usePosCatalog() {
  // The logged-in store (by slug) — the offline cache is refused if it
  // belongs to a different tenant (account switch on the same browser / a stale
  // or demo cache), so the POS never sells a product whose id doesn't exist for
  // THIS store. Runtime adds store_slug to the user; fall back to the
  // domain slug so we have a tenant key even before /me resolves.
  const { user } = useMe()
  const pid =
    (user as { store_slug?: string } | undefined)?.store_slug ||
    getPharmacySlug() ||
    null

  // Seeded from IndexedDB so search works on an offline cold start.
  const [cached, setCached] = useState<CatalogMed[] | null>(null)
  useEffect(() => {
    if (pid == null) return // wait until we know the store before trusting cache
    let alive = true
    void readCachedCatalog(pid).then((rows) => {
      if (alive && rows) setCached(rows)
    })
    return () => {
      alive = false
    }
  }, [pid])

  const { data } = useQuery({
    queryKey: ["pos-catalog"],
    queryFn: async () => (await posCatalog()).data.results,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Freshness watchdog: poll the tiny version fingerprint and refetch the
  // full catalogue ONLY when it changed — a price edited on the backend (or
  // another device, or an import) reaches this POS within ~45s instead of
  // the 5-minute worst case. Offline: the poll fails silently; the cached
  // catalogue keeps working and the next successful poll resyncs.
  const qc = useQueryClient()
  const lastVersion = useRef<string | null>(null)
  const { data: version } = useQuery({
    queryKey: ["catalog-version"],
    queryFn: async () => (await catalogVersion()).data.version,
    staleTime: 30_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  })
  useEffect(() => {
    if (!version) return
    if (lastVersion.current && version !== lastVersion.current) {
      void qc.invalidateQueries({ queryKey: ["pos-catalog"] })
    }
    lastVersion.current = version
  }, [version, qc])

  // Persist every fresh network copy for the next offline session — stamped
  // with the store so it can't be reused by another tenant.
  useEffect(() => {
    if (data && pid != null) void cacheCatalog(data, pid)
  }, [data, pid])

  const effective = data ?? cached ?? undefined

  const byBarcode = useMemo(() => {
    const map = new Map<string, ScanHit>()
    for (const m of effective ?? []) {
      const code = (m.barcode || "").trim()
      if (code && !map.has(code)) map.set(code, { med: m, variant: null })
      // Unit/packaging barcodes resolve to the same product (same stock/price).
      for (const alt of m.alt_barcodes ?? []) {
        const ac = (alt || "").trim()
        if (ac && !map.has(ac)) map.set(ac, { med: m, variant: null })
      }
      for (const v of m.variants ?? []) {
        const vc = (v.barcode || "").trim()
        if (vc) map.set(vc, { med: m, variant: v })
      }
    }
    return map
  }, [effective])

  // The set of product ids that ACTUALLY exist for this store right now —
  // used to reconcile persisted carts so a dead line can't reach checkout.
  const medIds = useMemo(
    () => new Set<number>((effective ?? []).map((m) => m.id)),
    [effective],
  )

  return {
    catalog: effective,
    byBarcode,
    ready: Boolean(effective),
    medIds,
    // Only trust reconcile when this is the FRESH network copy (not a cached /
    // offline snapshot), so we never drop a valid line while offline.
    fresh: Boolean(data),
  }
}
