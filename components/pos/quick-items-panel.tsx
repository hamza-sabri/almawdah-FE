"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"

import type { CatalogMed } from "@/api/sales"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The items that can't be scanned.
 *
 * The source data says this is not a fringe case: 196 of the shop's 2,398
 * products have NO barcode, they carry 26,240 sale lines (4.9% of every line
 * ever rung), and they appear on 1 in 8 receipts. They are the loose and
 * weighed goods and the services — سيجارة حلل, شحن رصيد, بيض, دخان — the
 * things a shop sells by the piece out of a box on the counter.
 *
 * Before this, the cashier had to type an Arabic name to reach them, on a
 * screen whose default view assumes a barcode gun.
 *
 * Everything here reads the catalogue the POS already holds in the browser
 * (mirrored to IndexedDB), so it works offline for free — no endpoint, no
 * network on the critical path.
 */

const RECENT_KEY = "mawadda_pos_quick_recent"
const RECENT_MAX = 8

/**
 * Tobacco sits at the top of the panel, above everything else.
 *
 * This is not a guess: in the shop's own export the barcode-less tobacco lines
 * are سيجارة حلل (14,257 sale lines), دخان امبريال (1,681), دخان عربي (1,439)
 * and دخان عالية (267). سيجارة حلل alone is more than half of every
 * barcode-less line ever rung. The owner asked for "دخان at the top" and the
 * data agrees with him.
 */
const TOBACCO_WORDS = ["دخان", "سيجارة", "سجائر", "سجاير", "تبغ", "معسل", "لفائف"]

function isTobacco(name: string): boolean {
  return TOBACCO_WORDS.some((w) => name.includes(w))
}

/**
 * Opening-day order inside the tobacco group, by real line count. Once the
 * cashier starts tapping, `recent` (below) overrides this — it is only here so
 * the panel is already sorted correctly the very first time it is opened, on a
 * device with an empty localStorage.
 */
const TOBACCO_HOT = ["سيجارة حلل", "دخان امبريال", "دخان عربي", "دخان عالية"]

function hotRank(name: string): number {
  const i = TOBACCO_HOT.findIndex((h) => name.trim().startsWith(h))
  return i === -1 ? Infinity : i
}

function readRecent(): number[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : []
  } catch {
    return []
  }
}

function pushRecent(id: number): number[] {
  const next = [id, ...readRecent().filter((n) => n !== id)].slice(0, RECENT_MAX)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode — ordering just won't persist */
  }
  return next
}

/**
 * A leftover from the old till: a name made only of zeros or punctuation, no
 * barcode, no price. The importer now skips these outright
 * (apps/store/management/commands/import_mawadda.py::_is_junk_name), but the
 * store that is already live has one — 50 zeros — and it sorted to the very
 * top of this panel, one tap away from putting ₪0.00 on a real receipt. This
 * hides it without waiting for anyone to clean the database.
 */
const JUNK_NAME = /^[0\s\-_.*#/\\]+$/

/** A product nobody can scan: no primary barcode and no extras either. */
export function isQuickItem(m: CatalogMed): boolean {
  if (JUNK_NAME.test(m.name || "")) return false
  return !(m.barcode || "").trim() && (m.alt_barcodes ?? []).length === 0
}

export function QuickItemsPanel({
  catalog,
  onPick,
}: {
  catalog?: CatalogMed[]
  onPick: (m: CatalogMed) => void
}) {
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : readRecent(),
  )

  const items = useMemo(() => {
    const all = (catalog ?? []).filter(isQuickItem)
    const q = query.trim().toLowerCase()
    const rows = q ? all.filter((m) => m.name.toLowerCase().includes(q)) : all
    // Ordering, in order of precedence:
    //   1. tobacco before everything else (owner's request, backed by the data)
    //   2. most-recently tapped first — the traffic is extremely concentrated
    //      (one item is over half of it), so after a shift the panel has sorted
    //      itself into the order this particular shop actually works in
    //   3. the known-hot seed, so day one is already right on a fresh device
    //   4. Arabic alphabetical, so the tail is at least predictable
    const rank = new Map(recent.map((id, i) => [id, i]))
    return [...rows].sort((a, b) => {
      const ta = isTobacco(a.name) ? 0 : 1
      const tb = isTobacco(b.name) ? 0 : 1
      if (ta !== tb) return ta - tb
      const ra = rank.get(a.id) ?? Infinity
      const rb = rank.get(b.id) ?? Infinity
      if (ra !== rb) return ra - rb
      const ha = hotRank(a.name)
      const hb = hotRank(b.name)
      if (ha !== hb) return ha - hb
      return a.name.localeCompare(b.name, "ar")
    })
  }, [catalog, query, recent])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative shrink-0">
        <Search className="absolute inset-y-0 end-2.5 my-auto size-4 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث…"
          aria-label="ابحث في الأصناف بدون باركود"
          className="h-9 w-full rounded-xl border bg-card pe-8 ps-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div
        data-slot="card"
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card"
      >
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {query ? "لا نتائج" : "لا توجد أصناف بدون باركود"}
          </p>
        ) : (
          items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setRecent(pushRecent(m.id))
                onPick(m)
              }}
              className={cn(
                "flex w-full items-center gap-2 border-b px-3 py-2.5 text-start transition",
                "last:border-b-0 hover:bg-primary/5 active:scale-[0.99]",
              )}
            >
              <Plus className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {m.name}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {formatMoney(m.price)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
