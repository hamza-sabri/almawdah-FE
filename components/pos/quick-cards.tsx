"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Cake,
  ChevronDown,
  Cigarette,
  Egg,
  Loader2,
  Package,
  Plus,
  Search,
  Smartphone,
  X,
} from "lucide-react"
import { toast } from "sonner"

import type { CatalogMed } from "@/api/sales"
import {
  getQuickGroups,
  putQuickGroups,
  type QuickGroup,
} from "@/api/quick-groups"
import { defaultGroups, groupProducts } from "@/lib/pos/quick-groups"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Quick cards — the handful of things this shop sells constantly.
 *
 * These sit in the toolbar NEXT TO جوال, not inside the "بدون باركود" panel.
 * The owner was explicit about it: the panel is a drawer you open to browse
 * 195 items, and needing to open a drawer to reach the two things you sell
 * every minute defeats the point of a shortcut. So they live where جوال lives
 * — always on screen — and behave the same way: tap to drop a small menu,
 * tap an option to ring it.
 *
 * The barcode-less traffic is wildly concentrated (سيجارة حلل alone is 14,257
 * sale lines), which is why a handful of buttons covers most of a shift.
 *
 * The grouping lives on the STORE, not the browser — see api/quick-groups.ts.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cigarette: Cigarette,
  egg: Egg,
  phone: Smartphone,
  cake: Cake,
}

function GroupIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Package
  return <I className={className} />
}

export function QuickCards({
  catalog,
  onPick,
}: {
  catalog?: CatalogMed[]
  onPick: (m: CatalogMed) => void
}) {
  const qc = useQueryClient()
  const rootRef = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const { data: saved, isLoading } = useQuery({
    queryKey: ["quick-groups"],
    queryFn: () => getQuickGroups().then((r) => r.data.groups),
    staleTime: 60_000,
  })

  const all = useMemo(() => catalog ?? [], [catalog])

  // Saved layout wins. Until the shop has one, derive cards from the
  // catalogue so day one is already useful.
  const groups: QuickGroup[] = useMemo(
    () => (saved && saved.length > 0 ? saved : defaultGroups(all)),
    [saved, all],
  )

  /**
   * Resolve every card up front, because whether a card opens a menu at all
   * depends on how many of its products still EXIST — not on how many ids it
   * stores. A card holding one live product and one that was deleted months
   * ago is a one-item card, and must ring on the first tap like any other.
   */
  const cards = useMemo(
    () => groups.map((g) => ({ group: g, items: groupProducts(g, all) })),
    [groups, all],
  )

  function closeAll() {
    setOpenKey(null)
    setAdding(null)
    setQuery("")
  }

  // Click away / Escape closes the menu, exactly like the جوال picker beside
  // it — otherwise a menu left open covers the cart while the cashier scans.
  useEffect(() => {
    if (!openKey) return
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeAll()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll()
    }
    document.addEventListener("pointerdown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("pointerdown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [openKey])

  const save = useMutation({
    mutationFn: (next: QuickGroup[]) => putQuickGroups(next),
    onSuccess: (r) => {
      qc.setQueryData(["quick-groups"], r.data.groups)
      toast.success("تم الحفظ")
    },
    onError: (e) => toast.error((e as Error)?.message || "تعذّر الحفظ"),
  })

  function addToGroup(key: string, id: number) {
    const next = groups.map((g) =>
      g.key === key && !g.product_ids.includes(id)
        ? { ...g, product_ids: [...g.product_ids, id] }
        : g,
    )
    save.mutate(next)
    setAdding(null)
    setQuery("")
  }

  function removeFromGroup(key: string, id: number) {
    save.mutate(
      groups.map((g) =>
        g.key === key
          ? { ...g, product_ids: g.product_ids.filter((p) => p !== id) }
          : g,
      ),
    )
  }

  // Nothing until the shop's own layout has answered. Painting the derived
  // defaults first and swapping them a moment later moves the buttons under a
  // cashier's finger mid-tap — on a till, with a customer waiting, that rings
  // up the wrong product. A blank half-second is the cheaper mistake.
  if (isLoading || groups.length === 0) return null

  // The picker searches the WHOLE catalogue, not just barcode-less items — the
  // owner may well want a scannable product on a card too.
  const q = query.trim().toLowerCase()
  const candidates = q
    ? all
        .filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.barcode || "").startsWith(q) ||
            (m.alt_barcodes ?? []).some((c) => c.startsWith(q)),
        )
        .slice(0, 25)
    : []

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-1.5">
      {cards.map(({ group: g, items }) => {
        const isOpen = openKey === g.key
        /**
         * A card holding exactly one product IS that product. Making the
         * cashier tap a button to open a menu that holds a single line, to tap
         * that line, is two taps to do one thing — and the owner said so. So a
         * one-item card rings straight into the cart, and the chevron beside
         * it is the way back to the + and the X.
         */
        const single = items.length === 1 ? items[0] : null
        const toggle = () => {
          setAdding(null)
          setQuery("")
          setOpenKey(isOpen ? null : g.key)
        }
        return (
          <div key={g.key} className="relative">
            <div
              className={cn(
                "flex h-10 items-stretch overflow-hidden rounded-xl border text-sm font-semibold transition",
                isOpen
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              <button
                type="button"
                data-testid={`quick-card-${g.key}`}
                onClick={
                  single
                    ? () => {
                        onPick(single)
                        closeAll()
                      }
                    : toggle
                }
                aria-expanded={single ? undefined : isOpen}
                aria-haspopup={single ? undefined : "menu"}
                title={
                  single
                    ? `${single.name} — اضغط للإضافة`
                    : `${g.label} — اضغط لاختيار الصنف`
                }
                className="flex items-center gap-1.5 px-3 transition hover:bg-muted/60"
              >
                <GroupIcon name={g.icon} className="size-4" />
                <span className="hidden sm:inline">{g.label}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {/* A count of "1" tells the cashier nothing. The price does. */}
                  {single ? formatMoney(single.price) : items.length}
                </span>
              </button>

              {/* Only a one-tap card needs this: for every other card the
                  button above already opens the menu. */}
              {single && (
                <button
                  type="button"
                  data-testid={`quick-card-${g.key}-menu`}
                  onClick={toggle}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  aria-label={`تعديل «${g.label}»`}
                  title={`تعديل «${g.label}»`}
                  className="flex items-center border-s px-1.5 transition hover:bg-muted/60"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              )}
            </div>

            {isOpen && (
              <div
                role="menu"
                aria-label={`أصناف ${g.label}`}
                data-testid="quick-card-options"
                className="animate-in fade-in zoom-in-95 absolute top-full start-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border bg-card shadow-lg duration-100"
              >
                <div className="max-h-72 overflow-y-auto">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-1 border-b last:border-b-0"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onPick(m)
                          closeAll()
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-start transition hover:bg-primary/5 active:scale-[0.99]"
                      >
                        <Plus className="size-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {m.name}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                          {formatMoney(m.price)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromGroup(g.key, m.id)}
                        title="إزالة من هذه المجموعة"
                        aria-label="إزالة من هذه المجموعة"
                        className="me-1 shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* The + at the end of every list */}
                {adding === g.key ? (
                  <div className="space-y-1.5 border-t bg-muted/30 p-2">
                    <div className="relative">
                      <Search className="absolute inset-y-0 end-2.5 my-auto size-4 text-muted-foreground/60" />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ابحث بالاسم أو امسح الباركود…"
                        aria-label="ابحث عن صنف لإضافته"
                        className="h-9 w-full rounded-xl border bg-card pe-8 ps-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div
                      data-testid="quick-card-picker"
                      className="max-h-52 overflow-y-auto rounded-xl border bg-card"
                    >
                      {candidates.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          {q ? "لا نتائج" : "اكتب للبحث"}
                        </p>
                      ) : (
                        candidates.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => addToGroup(g.key, m.id)}
                            className="flex w-full items-center gap-2 border-b px-3 py-2 text-start last:border-b-0 hover:bg-primary/5"
                          >
                            <Plus className="size-3.5 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {m.name}
                            </span>
                            <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                              {formatMoney(m.price)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(null)
                        setQuery("")
                      }}
                      className="w-full rounded-lg py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(g.key)}
                    disabled={save.isPending}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-dashed py-2 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-50"
                  >
                    {save.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    إضافة صنف إلى «{g.label}»
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
