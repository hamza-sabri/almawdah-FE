"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChartColumn,
  LayoutGrid,
  Loader2,
  Minus,
  Layers,
  Package,
  Plus,
  Printer,
  ScanBarcode,
  ShoppingBag,
  TableProperties,
  Trash2,
  Undo2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"

import { productsList } from "@/api/generated/products/products"
import type { Product } from "@/api/generated/model"
import { colorHexOf } from "@/lib/variant-options"
import {
  salesStats,
  saleItemName,
  type CatalogMed,
  type CatalogVariant,
  type Sale,
  type SalePayload,
} from "@/api/sales"
import { useMe, displayName } from "@/hooks/use-me"
import { submitSale } from "@/lib/offline/submit-sale"
import { clearOfflineCaches } from "@/lib/offline/catalog-cache"
import type { QueuedSale } from "@/lib/offline/queue"
import { printReceipt, type ReceiptData } from "@/lib/print/receipt"
import { loadPrintSettings } from "@/lib/print/settings"
import { PrintSettingsDialog } from "@/components/print/print-settings-dialog"
import { PrintReceiptDialog } from "@/components/print/print-receipt-dialog"
import { useInfiniteList } from "@/hooks/use-infinite-list"
import { usePosCatalog } from "@/hooks/use-pos-catalog"
import { useGlobalScanner } from "@/hooks/use-global-scanner"
import { useCustomersCatalog } from "@/hooks/use-customers-catalog"
import { useDebounced } from "@/hooks/use-debounced"
import {
  usePosCarts,
  cartTotal,
  type CartLine,
  type CartVariant,
} from "@/hooks/use-pos-carts"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { isMuted, playBeep, setMuted } from "@/lib/beep"
import { cn } from "@/lib/utils"

import { SearchInput } from "@/components/search-input"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { LoadMore } from "@/components/load-more"
import { EntityCombobox, type ComboOption } from "@/components/entity-combobox"
import { ConfirmDelete } from "@/components/confirm-delete"
import { CustomerForm } from "@/components/forms/customer-form"
import { InlineScanner } from "@/components/scan/inline-scanner"
import type { ScanFeedback } from "@/components/scan/scan-dialog"
import { EmptyState, ErrorState } from "@/components/states"
import { NoMedsArt } from "@/components/illustrations"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type Pos = ReturnType<typeof usePosCarts>

/** Snapshot of the cart at checkout — feeds the printed receipt and, when
 *  offline, renders the queued sale without waiting for the server. */
type SaleSnapshot = {
  items: { name: string; quantity: number; unitPrice: string }[]
  total: number
  discountedTotal: number
  isReturn: boolean
  paymentMethod: "cash" | "debt"
  customerName?: string
}

type CheckoutInput = { body: SalePayload; snapshot: SaleSnapshot }

function receiptFromSale(sale: Sale, cashierName: string): ReceiptData {
  return {
    saleId: sale.id,
    items: sale.items.map((it) => ({
      name: saleItemName(it),
      quantity: it.quantity,
      unitPrice: it.unit_price,
      lineTotal: it.line_total,
    })),
    total: toNumber(sale.total),
    discountedTotal: toNumber(sale.discounted_total),
    paymentMethod: sale.payment_method,
    isReturn: Boolean(sale.is_return),
    customerName: sale.customer_name,
    cashierName: sale.created_by_name || cashierName,
    createdAt: sale.created_at,
  }
}

function receiptFromQueued(
  snap: SaleSnapshot,
  queued: QueuedSale,
  cashierName: string,
): ReceiptData {
  return {
    saleId: `مؤقت ${queued.clientUuid.slice(0, 6)}`,
    items: snap.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    total: snap.total,
    discountedTotal: snap.discountedTotal,
    paymentMethod: snap.paymentMethod,
    isReturn: snap.isReturn,
    customerName: snap.customerName,
    cashierName,
    createdAt: new Date(queued.createdAt),
    offline: true,
  }
}

/** Shared checkout (cart panel + table mode). Online → post + print the
 *  receipt; offline/unreachable → queue for auto-sync and print an "unsynced"
 *  copy so the customer still walks away with a receipt. */
function useCheckout(pos: Pos, onDone?: () => void) {
  const qc = useQueryClient()
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "المتجر"
  const pharmacyLogo = me?.pharmacy_logo || ""

  return useMutation({
    mutationFn: async ({ body, snapshot }: CheckoutInput) => {
      const res = await submitSale(body, {
        total: snapshot.total,
        discountedTotal: snapshot.discountedTotal,
        isReturn: snapshot.isReturn,
        paymentMethod: snapshot.paymentMethod,
        customerName: snapshot.customerName,
        cashierName,
      })
      return { res, snapshot }
    },
    onSuccess: ({ res, snapshot }) => {
      const settings = loadPrintSettings()
      if (res.status === "synced") {
        const sale = res.sale
        toast.success(
          `${sale.is_return ? "تم الإرجاع" : "تم البيع"} — ${formatMoney(sale.discounted_total)}`,
        )
        if (settings.autoPrint) {
          printReceipt(receiptFromSale(sale, cashierName), pharmacyName, settings, pharmacyLogo)
        }
        qc.invalidateQueries({ queryKey: ["products"] })
        qc.invalidateQueries({ queryKey: ["sales"] })
        qc.invalidateQueries({ queryKey: ["sales-stats"] })
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
        qc.invalidateQueries({ queryKey: ["customers"] })
        qc.invalidateQueries({ queryKey: ["customers-quick"] })
      } else {
        toast.warning("لا يوجد اتصال — حُفظت الفاتورة وستُزامن تلقائياً عند عودة الشبكة", {
          duration: 5000,
        })
        if (settings.autoPrint) {
          // No real sale number yet → suppress the (misleading) barcode.
          printReceipt(
            receiptFromQueued(snapshot, res.queued, cashierName),
            pharmacyName,
            { ...settings, receiptBarcode: false },
            pharmacyLogo,
          )
        }
      }
      pos.closeCart(pos.activeId)
      onDone?.()
    },
    onError: (e) => {
      const err = e as Error & { status?: number; data?: unknown }
      const msg = err?.message ?? ""

      // The server rejected one or more product ids — a dead line left in the
      // saved cart (a product deleted/re-imported, or an old cached id). Find
      // EXACTLY which lines it rejected and drop just those, so the rest of the
      // cart can check out. `items[i]` maps 1:1 to the active cart's lines[i].
      const lines = pos.active?.lines ?? []
      const badKeys = new Set<string>()
      const data = err?.data as { items?: Array<{ product?: unknown }> } | undefined
      if (Array.isArray(data?.items)) {
        data!.items.forEach((it, i) => {
          if (it && it.product && lines[i]) badKeys.add(lines[i].key)
        })
      }
      // Fallback: pull ids straight out of the "Invalid pk \"15\"" message.
      const ids = new Set<number>()
      for (const m of msg.matchAll(/Invalid pk\s*"?(\d+)"?/gi)) ids.add(Number(m[1]))
      for (const l of lines) {
        if (l.medicationId != null && ids.has(l.medicationId)) badKeys.add(l.key)
      }

      if (badKeys.size > 0) {
        for (const key of badKeys) pos.removeLine(key)
        void clearOfflineCaches()
        qc.invalidateQueries({ queryKey: ["pos-catalog"] })
        qc.invalidateQueries({ queryKey: ["catalog-version"] })
        toast.error(
          `أُزيل ${badKeys.size} صنف لم يعد موجوداً من السلة — راجع السلة وأعد إتمام البيع`,
        )
        return
      }
      toast.error(msg || "تعذر إتمام البيع")
    },
  })
}

function buildPayload(pos: Pos): CheckoutInput | null {
  const active = pos.active
  if (!active || active.lines.length === 0) {
    toast.error("السلة فارغة")
    return null
  }
  if (active.payment === "debt" && !active.customerId) {
    toast.error("بيع بالدين يتطلب اختيار الزبون")
    return null
  }
  const total = cartTotal(active)
  const discounted = active.discounted.trim() ? toNumber(active.discounted) : null
  // A customer is attached ONLY for debt sales (that's who owes).
  const isDebt = !active.isReturn && active.payment === "debt"
  const paymentMethod: "cash" | "debt" = active.isReturn ? "cash" : active.payment
  const body: SalePayload = {
    customer: isDebt ? (active.customerId ?? undefined) : undefined,
    payment_method: paymentMethod,
    is_return: active.isReturn || undefined,
    items: active.lines.map((l) => ({
      product: l.medicationId ?? undefined,
      variant: l.variantId ?? undefined,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    })),
    discounted_total:
      discounted != null && discounted !== total
        ? discounted.toFixed(2)
        : undefined,
  }
  const snapshot: SaleSnapshot = {
    items: active.lines.map((l) => ({
      name: l.variantLabel ? `${l.name} — ${l.variantLabel}` : l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    total,
    discountedTotal: discounted != null ? discounted : total,
    isReturn: Boolean(active.isReturn),
    paymentMethod,
    customerName: active.customerName || undefined,
  }
  return { body, snapshot }
}

/* ── Parked-carts tabs ─────────────────────────────────────────────── */
function CartTabs({ pos }: { pos: Pos }) {
  const [toClose, setToClose] = useState<string | null>(null)
  const closable = pos.carts.length > 1

  function requestClose(id: string) {
    const cart = pos.carts.find((c) => c.id === id)
    // Empty carts (the misclicks) close instantly; loaded ones ask first.
    if (!cart || cart.lines.length === 0) {
      pos.closeCart(id)
      return
    }
    setToClose(id)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pos.carts.map((c, i) => {
        const isActive = c.id === pos.activeId
        return (
          <span
            key={c.id}
            className={cn(
              "inline-flex items-center overflow-hidden rounded-full transition-all",
              isActive
                ? "bg-ink text-white shadow-md shadow-ink/25"
                : "bg-muted text-muted-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => pos.setActiveId(c.id)}
              className={cn(
                "py-1.5 ps-3 text-xs font-semibold",
                closable ? "pe-1" : "pe-3",
                !isActive && "hover:text-foreground",
              )}
            >
              {c.isReturn && (
                <Undo2 className="me-1 inline size-3 text-destructive" />
              )}
              {c.customerName || `سلة ${i + 1}`}
              {c.lines.length > 0 && (
                <span className={isActive ? "text-lime" : "text-primary"}>
                  {" "}
                  · {formatMoney(cartTotal(c))}
                </span>
              )}
            </button>
            {closable && (
              <button
                type="button"
                onClick={() => requestClose(c.id)}
                aria-label="إغلاق السلة"
                className={cn(
                  "grid size-5 place-items-center rounded-full transition me-1.5",
                  isActive
                    ? "text-white/50 hover:bg-white/15 hover:text-white"
                    : "text-muted-foreground/50 hover:bg-foreground/10 hover:text-foreground",
                )}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        )
      })}
      <button
        type="button"
        data-tour="pos-new-cart"
        onClick={pos.parkAndNew}
        title="بيع جديد (تعليق الحالي)"
        className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
      >
        <Plus className="size-4" />
      </button>
      <ConfirmDelete
        open={toClose != null}
        onOpenChange={(o) => !o && setToClose(null)}
        onConfirm={() => {
          if (toClose) pos.closeCart(toClose)
          setToClose(null)
        }}
        title="إغلاق السلة"
        description="تحتوي هذه السلة على أصناف — سيتم تفريغها وإغلاقها."
        confirmLabel="إغلاق"
      />
    </div>
  )
}

/** Sale ⇄ return switch — flips the whole cart into refund mode. */
function ReturnToggle({ pos }: { pos: Pos }) {
  const active = pos.active
  if (!active) return null
  return (
    <button
      type="button"
      data-tour="pos-return"
      onClick={() =>
        pos.patchActive({ isReturn: !active.isReturn, payment: "cash" })
      }
      aria-pressed={active.isReturn}
      title={active.isReturn ? "العودة لوضع البيع" : "وضع الإرجاع"}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
        active.isReturn
          ? "bg-destructive text-white shadow-md shadow-destructive/30"
          : "bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      <Undo2 className="size-3.5" />
      {active.isReturn ? "وضع الإرجاع" : "إرجاع"}
    </button>
  )
}

/* ── Customer + payment + discount controls ────────────────────────── */
function SaleControls({ pos }: { pos: Pos }) {
  const { active, patchActive } = pos
  const [custFormOpen, setCustFormOpen] = useState(false)
  // Instant local customer search (Redis-cached catalogue).
  const { fetcher: customerFetcher } = useCustomersCatalog()
  const total = active ? cartTotal(active) : 0

  // Keep the discount field showing the live total until the cashier edits it.
  useEffect(() => {
    if (!active || active.discountTouched) return
    const t = total.toFixed(2)
    if (active.discounted !== t) patchActive({ discounted: t })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, active?.id, active?.discountTouched])

  if (!active) return null
  const isDebt = !active.isReturn && active.payment === "debt"

  return (
    <div className="space-y-2.5">
      {/* Payment method first — the customer picker only follows for debt. */}
      {!active.isReturn && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "cash", label: "نقدي" },
              { value: "debt", label: "دين" },
            ] as const
          ).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => patchActive({ payment: p.value })}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold transition-all",
                active.payment === p.value
                  ? "bg-ink text-white shadow-md shadow-ink/25"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Customer — ONLY for debt sales, and required to check out. */}
      {isDebt && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-1.5 duration-200">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <EntityCombobox
                value={active.customerId}
                label={active.customerName}
                onChange={(opt) =>
                  patchActive({
                    customerId: opt?.id ?? null,
                    customerName: opt?.label ?? "",
                  })
                }
                fetcher={customerFetcher}
                placeholder="اختر الزبون (مطلوب للدين)"
                searchPlaceholder="ابحث بالاسم أو الهاتف…"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustFormOpen(true)}
              aria-label="زبون جديد"
              title="زبون جديد"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15"
            >
              <UserPlus className="size-4.5" />
            </button>
          </div>
          {!active.customerId && (
            <p className="ps-1 text-xs text-destructive">
              اختر الزبون لإتمام البيع بالدين
            </p>
          )}
        </div>
      )}

      <Input
        type="number"
        step="0.5"
        min="0"
        dir="ltr"
        placeholder={`الإجمالي بعد الخصم (${total.toFixed(2)})`}
        className="text-start"
        value={active.discounted}
        onChange={(e) =>
          patchActive({ discounted: e.target.value, discountTouched: true })
        }
      />
      <CustomerForm
        open={custFormOpen}
        onOpenChange={setCustFormOpen}
        onSaved={(c) =>
          patchActive({ customerId: c.id, customerName: c.name })
        }
      />
    </div>
  )
}

function TotalRow({ pos }: { pos: Pos }) {
  const active = pos.active
  if (!active) return null
  const total = cartTotal(active)
  const discounted = active.discounted.trim() ? toNumber(active.discounted) : null
  return (
    <div className="flex items-baseline justify-between rounded-2xl bg-muted/60 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">الإجمالي</span>
      <span className="font-heading text-2xl font-bold">
        {discounted != null && discounted !== total ? (
          <>
            <span className="me-2 text-sm text-muted-foreground line-through">
              {formatMoney(total)}
            </span>
            {formatMoney(discounted)}
          </>
        ) : (
          formatMoney(total)
        )}
      </span>
    </div>
  )
}

function CheckoutButtons({
  pos,
  checkout,
}: {
  pos: Pos
  checkout: ReturnType<typeof useCheckout>
}) {
  const active = pos.active
  // Debt sales can't be completed without a customer.
  const needsCustomer =
    !!active && !active.isReturn && active.payment === "debt" && !active.customerId
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-tour="pos-checkout"
        onClick={() => {
          const input = buildPayload(pos)
          if (input) checkout.mutate(input)
        }}
        disabled={
          checkout.isPending ||
          !active ||
          active.lines.length === 0 ||
          needsCustomer
        }
        className={cn(
          "flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl font-heading text-base font-bold transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50",
          active?.isReturn
            ? "bg-destructive text-white shadow-lg shadow-destructive/30"
            : "bg-lime text-lime-foreground shadow-lg shadow-lime/30",
        )}
      >
        {checkout.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : active?.isReturn ? (
          <Undo2 className="size-5" />
        ) : (
          <ShoppingBag className="size-5" />
        )}
        {active?.isReturn ? "إتمام الإرجاع" : "إتمام البيع"}
      </button>
      {active && active.lines.length > 0 && (
        <button
          type="button"
          onClick={() => pos.closeCart(pos.activeId)}
          title="إلغاء هذه السلة"
          className="grid size-13 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive transition hover:bg-destructive/15"
        >
          <Trash2 className="size-5" />
        </button>
      )}
    </div>
  )
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

function formatQty(n: number): string {
  return String(roundQty(n))
}

// A keystroke burst this long, arriving at scanner speed, is a barcode — not a
// human quantity. Matches the global scanner's thresholds.
const SCAN_MIN_LEN = 3
const SCAN_MAX_GAP = 80 // ms between keys that still counts as one burst

/** Quantity control: ± steppers, a free decimal field, and ½ ⅓ ¼ chips.
 *  A value of 0 (or blank) removes the line.
 *
 *  When `focusSignal` changes, the field is focused + selected so the cashier
 *  can immediately type the new quantity. It stays scanner-safe: a fast barcode
 *  burst typed while it's focused is redirected to `onScanBurst` (and never
 *  lands in the quantity), and a plain Enter fires `onSubmitSale`. */
function QtyEditor({
  value,
  onChange,
  focusSignal,
  onScanBurst,
  onSubmitSale,
}: {
  value: number
  onChange: (q: number) => void
  focusSignal?: number
  onScanBurst?: (code: string) => void
  onSubmitSale?: () => void
}) {
  const [text, setText] = useState(formatQty(value))
  const inputRef = useRef<HTMLInputElement>(null)
  // Burst tracker: chars since the last idle gap, when the last key landed, and
  // the field value before the burst (restored if it turns out to be a scan).
  const burst = useRef({ chars: "", last: 0, base: "" })
  useEffect(() => {
    setText(formatQty(value))
  }, [value])
  // Auto-focus + select on demand — desktop/keyboard only, so we never pop the
  // on-screen keyboard on a touch device.
  useEffect(() => {
    if (focusSignal === undefined) return
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)")?.matches === false
    )
      return
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [focusSignal])
  function commit() {
    const n = parseFloat(text.replace(",", "."))
    onChange(!isFinite(n) || n <= 0 ? 0 : roundQty(n))
  }
  function onKeyDown(e: { key: string; preventDefault: () => void }) {
    const now = Date.now()
    const b = burst.current
    if (e.key === "Enter") {
      const code = b.chars
      const base = b.base
      b.chars = ""
      b.base = ""
      b.last = 0
      // A fast, long burst ending in Enter is a scanned barcode → hand it to the
      // scan handler and undo any digits that leaked into the field.
      if (onScanBurst && code.length >= SCAN_MIN_LEN) {
        e.preventDefault()
        setText(base)
        onScanBurst(code)
        return
      }
      // Otherwise it's a human Enter → keep the typed quantity, complete the sale.
      e.preventDefault()
      commit()
      onSubmitSale?.()
      return
    }
    if (e.key.length === 1) {
      const gap = now - b.last
      if (b.chars === "" || gap >= SCAN_MAX_GAP) {
        // A slow keystroke starts a fresh sequence, so human typing never
        // accumulates into a "scan" — only a real burst reaches SCAN_MIN_LEN.
        b.chars = e.key
        b.base = text
      } else {
        b.chars += e.key
      }
      b.last = now
      // Not prevented: the char flows into the field; a scan is reverted at Enter.
    }
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(roundQty(value + 1))}
          className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary active:scale-90"
          aria-label="زيادة"
        >
          <Plus className="size-3.5" />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          inputMode="decimal"
          dir="ltr"
          className="h-7 w-12 rounded-lg border bg-card text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="الكمية"
        />
        <button
          type="button"
          onClick={() => onChange(roundQty(value - 1))}
          className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground active:scale-90"
          aria-label="إنقاص"
        >
          <Minus className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-1">
        {([["½", 0.5], ["⅓", 1 / 3], ["¼", 0.25]] as const).map(([lbl, q]) => (
          <button
            key={lbl}
            type="button"
            onClick={() => onChange(roundQty(q))}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-90"
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Cart line row (newest first, pops in on mount) ────────────────── */
function CartLineRow({
  line,
  pos,
  focusSignal,
  onScanBurst,
  onSubmitSale,
}: {
  line: CartLine
  pos: Pos
  focusSignal?: number
  onScanBurst?: (code: string) => void
  onSubmitSale?: () => void
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 slide-in-from-top-1 flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 duration-300">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.name}</p>
        {line.variantLabel ? (
          <p className="truncate text-[11px] font-semibold text-primary">
            {line.variantLabel}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {formatMoney(line.unitPrice)}
        </p>
      </div>
      <QtyEditor
        value={line.quantity}
        onChange={(q) => pos.setQuantity(line.key, q)}
        focusSignal={focusSignal}
        onScanBurst={onScanBurst}
        onSubmitSale={onSubmitSale}
      />
      <span className="w-16 text-end text-sm font-bold tabular-nums">
        {formatMoney(toNumber(line.unitPrice) * line.quantity)}
      </span>
      <button
        type="button"
        onClick={() => pos.removeLine(line.key)}
        className="text-muted-foreground/60 transition hover:text-destructive"
        aria-label="حذف"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/* ── The cart panel (desktop column + mobile sheet) ────────────────── */
function CartPanel({
  pos,
  onDone,
  totalOnTop = false,
  onScanCode,
  defaultScanning = false,
  onScanBurst,
  onSubmitSale,
}: {
  pos: Pos
  onDone?: () => void
  totalOnTop?: boolean
  /** When set, a camera toggle lets you scan straight into this cart. */
  onScanCode?: (code: string) => Promise<ScanFeedback>
  /** Open with the camera already running (search-bar scan shortcut). */
  defaultScanning?: boolean
  /** Keyboard-wedge burst captured inside the quantity field → add to cart. */
  onScanBurst?: (code: string) => void
  /** Plain Enter in the quantity field → complete the sale. */
  onSubmitSale?: () => void
}) {
  const [scanning, setScanning] = useState(defaultScanning)
  const checkout = useCheckout(pos, onDone)
  const active = pos.active
  if (!active) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        {onScanCode && (
          <button
            type="button"
            onClick={() => setScanning((s) => !s)}
            aria-pressed={scanning}
            title={scanning ? "إيقاف الكاميرا" : "مسح متواصل"}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full transition",
              scanning
                ? "bg-lime text-lime-foreground shadow-md shadow-lime/30"
                : "bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <ScanBarcode className="size-4.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <CartTabs pos={pos} />
        </div>
        <ReturnToggle pos={pos} />
      </div>

      {active.isReturn && (
        <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-2 rounded-2xl bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive duration-200">
          <Undo2 className="size-4 shrink-0" />
          وضع الإرجاع — المخزون سيُعاد والمبلغ سيُخصم من المبيعات
        </div>
      )}

      {/* Live camera: scan → line pops into the list right below. */}
      {onScanCode && scanning && (
        <InlineScanner onDetect={onScanCode} className="h-[30dvh] shrink-0" />
      )}

      {totalOnTop && <TotalRow pos={pos} />}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {active.lines.length === 0 && (
          <div className="grid place-items-center rounded-2xl bg-muted/50 py-10 text-center text-sm text-muted-foreground">
            <ShoppingBag className="mb-2 size-7 opacity-40" />
            {scanning ? "وجّه الكاميرا نحو باركود" : "اضغط على منتج لإضافته"}
          </div>
        )}
        {[...active.lines].reverse().map((l) => (
          <CartLineRow
            key={l.key}
            line={l}
            pos={pos}
            focusSignal={l.key === pos.lastAddedKey ? pos.addTick : undefined}
            onScanBurst={onScanBurst}
            onSubmitSale={onSubmitSale}
          />
        ))}
      </div>

      <div className="space-y-2.5 border-t border-border/70 pt-3">
        <SaleControls pos={pos} />
      </div>

      <div className="space-y-2">
        {!totalOnTop && <TotalRow pos={pos} />}
        <CheckoutButtons pos={pos} checkout={checkout} />
      </div>
    </div>
  )
}

/* ── CatalogItem tile: one tap adds it to the cart ─────────────────────── */
function ProductTile({
  med,
  onAdd,
}: {
  med: Product
  onAdd: (m: Product) => void
}) {
  // DRF serialises DecimalField as a string, so this arrived as
  // `string | number` and every `stock <= 5` was relying on JS
  // coercion. Coerce once, here.
  const stock = Number(med.stock ?? 0)
  const variantCount =
    (med as unknown as { variants?: unknown[] }).variants?.length ?? 0
  return (
    <button
      type="button"
      onClick={() => onAdd(med)}
      className="pos-tile group text-start"
    >
      <Card className="card-interactive h-full gap-0 p-3 transition group-active:scale-[0.97]">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="bg-brand-soft grid size-9 shrink-0 place-items-center rounded-xl">
            <Package className="size-4.5 text-primary/60" />
          </span>
          <span
            className={`pill px-2 py-0.5 text-[10px] ${
              stock <= 0 ? "pill-danger" : stock <= 5 ? "pill-warning" : "pill-neutral"
            }`}
          >
            {formatNumber(stock)}
          </span>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">
          {med.name}
        </p>
        {variantCount > 0 && (
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Layers className="size-3" />
            {formatNumber(variantCount)} أنواع
          </span>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-heading text-base font-bold text-primary">
            {formatMoney(med.price)}
          </span>
          <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
            <Plus className="size-3.5" />
          </span>
        </div>
      </Card>
    </button>
  )
}

/* ── Table mode: scan-first, one big live table ────────────────────── */
function TableMode({
  pos,
  searchRaw,
  setSearchRaw,
  onScanCode,
  onWedgeEnter,
  catalog,
  onPick,
  onSubmitSale,
}: {
  pos: Pos
  searchRaw: string
  setSearchRaw: (v: string) => void
  onScanCode: (code: string) => Promise<ScanFeedback>
  onWedgeEnter: (value: string) => void
  catalog?: CatalogMed[]
  onPick: (m: CatalogMed) => void
  onSubmitSale?: () => void
}) {
  const checkout = useCheckout(pos)
  const active = pos.active

  // Live filtering against the client-held catalogue — every keystroke
  // narrows the list instantly (no network), tap a match to add it.
  const query = searchRaw.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!query || !catalog) return []
    return catalog
      .filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.barcode || "").startsWith(query),
      )
      .slice(0, 8)
  }, [query, catalog])

  if (!active) return null
  const lines = [...active.lines].reverse()

  return (
    // Fixed-height layout: the items table scrolls in the middle while the
    // payment controls + total stay pinned and always visible below.
    <div className="flex h-[calc(100dvh-19.5rem)] min-h-[26rem] flex-col gap-3 lg:h-[calc(100dvh-13.5rem)]">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CartTabs pos={pos} />
        </div>
        <ReturnToggle pos={pos} />
      </div>
      {active.isReturn && (
        <div className="animate-in fade-in flex items-center gap-2 rounded-2xl bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive duration-200">
          <Undo2 className="size-4 shrink-0" />
          وضع الإرجاع — المخزون سيُعاد والمبلغ سيُخصم من المبيعات
        </div>
      )}
      <SearchInput
        value={searchRaw}
        onChange={setSearchRaw}
        placeholder="امسح الباركود أو ابحث بالاسم…"
        scan
        onScan={onScanCode}
        scanContinuous
        onEnter={onWedgeEnter}
      />

      {/* Filtered catalogue matches — tap to add to the cart */}
      {query && (
        <div className="animate-in fade-in slide-in-from-top-1 max-h-56 shrink-0 overflow-y-auto rounded-2xl border bg-card shadow-sm duration-150">
          {matches.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              لا نتائج مطابقة — جرّب اسماً أو باركوداً آخر
            </p>
          )}
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-start transition last:border-b-0 hover:bg-primary/5 active:scale-[0.995]"
            >
              <Plus className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {m.name}
              </span>
              <span
                className={`pill ${
                  m.stock <= 0
                    ? "pill-danger"
                    : m.stock <= 5
                      ? "pill-warning"
                      : "pill-neutral"
                }`}
              >
                {formatNumber(m.stock)}
              </span>
              <span className="shrink-0 font-heading text-sm font-bold text-primary tabular-nums">
                {formatMoney(m.price)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div
        data-slot="card"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-3xl border bg-card",
          "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card",
          active.isReturn && "return-glow",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-start">الصنف</TableHead>
              <TableHead className="text-end">السعر</TableHead>
              <TableHead className="text-center">الكمية</TableHead>
              <TableHead className="text-end">المجموع</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  <ScanBarcode className="mx-auto mb-2 size-7 opacity-40" />
                  امسح باركوداً لبدء البيع
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow
                key={l.key}
                className="animate-in fade-in slide-in-from-top-1 duration-300"
              >
                <TableCell className="max-w-[240px] font-medium">
                  <p className="truncate">{l.name}</p>
                  {l.variantLabel ? (
                    <p className="truncate text-[11px] font-semibold text-primary">
                      {l.variantLabel}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatMoney(l.unitPrice)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <QtyEditor
                      value={l.quantity}
                      onChange={(q) => pos.setQuantity(l.key, q)}
                      onScanBurst={onWedgeEnter}
                      onSubmitSale={onSubmitSale}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-end font-heading font-bold tabular-nums">
                  {formatMoney(toNumber(l.unitPrice) * l.quantity)}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => pos.removeLine(l.key)}
                    className="text-muted-foreground/60 transition hover:text-destructive"
                    aria-label="حذف"
                  >
                    <X className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <SaleControls pos={pos} />
        <div className="space-y-2">
          <TotalRow pos={pos} />
          <CheckoutButtons pos={pos} checkout={checkout} />
        </div>
      </div>
    </div>
  )
}

/* ── POS home ──────────────────────────────────────────────────────── */
export default function PosPage() {
  const pos = usePosCarts()
  const pageCheckout = useCheckout(pos)
  // Complete the active cart's sale (fired by a bare Enter, or Enter from the
  // auto-focused quantity field). Silent no-op on an empty cart so a stray
  // Enter never nags the cashier.
  const submitActiveSale = () => {
    if (pageCheckout.isPending) return
    if (!pos.active || pos.active.lines.length === 0) return
    const input = buildPayload(pos)
    if (input) pageCheckout.mutate(input)
  }
  // Table is the default view for this store — the cashier works from a
  // barcode scanner and a list, not a picture grid.
  const [mode, setMode] = useState<"grid" | "table">("table")
  const [searchRaw, setSearchRaw] = useState("")
  const search = useDebounced(searchRaw, 250)
  // A hardware scanner types its burst anywhere — capture it without needing
  // the search box focused, and add the matched product straight to the cart
  // (falls back to filling the search box only when the code is ambiguous). A
  // bare Enter (nothing focused, no burst) completes the sale.
  useGlobalScanner((code) => void handleWedgeEnter(code), {
    onEnter: submitActiveSale,
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [sheetScan, setSheetScan] = useState(false)
  const [bump, setBump] = useState(0)
  const scope = useRef<HTMLDivElement>(null)

  // Remember the cashier's preferred mode + sound preference.
  const [muted, setMutedState] = useState(false)
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  useEffect(() => {
    const m = window.localStorage.getItem("alrahmah_pos_mode")
    if (m === "grid") setMode("grid")
    setMutedState(isMuted())
  }, [])
  function switchMode(m: "grid" | "table") {
    setMode(m)
    try {
      window.localStorage.setItem("alrahmah_pos_mode", m)
    } catch {
      /* ignore */
    }
  }

  /** Add + feedback: chirp and make the cart bounce. */
  function addWithFeedback(med: Product, variant?: CartVariant) {
    pos.addMedication(med, variant)
    playBeep(true)
    setBump((b) => b + 1)
  }

  const [bumping, setBumping] = useState(false)
  useEffect(() => {
    if (bump === 0) return
    setBumping(true)
    const t = setTimeout(() => setBumping(false), 380)
    return () => clearTimeout(t)
  }, [bump])

  const { data: stats } = useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => (await salesStats()).data,
    staleTime: 60_000,
  })

  const params = useMemo(
    () => ({ search: search || undefined, ordering: "name", page_size: 30 }),
    [search],
  )
  const {
    items,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteList<Product>(["products"], productsList, params)

  useStaggerCards(
    scope,
    ".pos-tile",
    mode === "grid" && !isLoading && items.length > 0,
    [search, mode],
  )

  // The whole catalogue lives client-side → scans resolve with ZERO latency.
  const {
    catalog,
    byBarcode,
    ready: catalogReady,
    medIds,
    fresh: catalogFresh,
  } = usePosCatalog()

  // FULL PREVENTION: the moment the FRESH catalogue is known, purge any dead
  // line (a deleted/re-imported product, or a legacy stale id) from EVERY cart,
  // so a nonexistent item can never reach checkout. Gated to the fresh network
  // copy so we never drop a valid line while offline; the checkout error-handler
  // remains as the last-resort net for that offline edge.
  useEffect(() => {
    if (!catalogFresh || medIds.size === 0) return
    const removed = pos.reconcile((id) => medIds.has(id))
    if (removed > 0) {
      toast.warning(`أُزيل ${removed} صنف لم يعد متوفراً من السلة`)
    }
  }, [catalogFresh, medIds, pos.reconcile])

  function catalogToMed(m: CatalogMed): Product {
    return {
      id: m.id,
      name: m.name,
      price: String(m.price),
      stock: m.stock,
      barcode: m.barcode,
      category: m.category,
    } as unknown as Product
  }

  function medVariants(m: Product | CatalogMed): CatalogVariant[] {
    const vs = (m as { variants?: CatalogVariant[] }).variants ?? []
    return vs.filter((v) => (v as { is_active?: boolean }).is_active !== false)
  }

  function variantToCart(
    v: CatalogVariant,
    medPrice: string | number,
  ): CartVariant {
    // A variant's price defaults to the product price when it has none of its
    // own — it's the price shown/charged when this option is picked.
    const price = Number(v.price) > 0 ? v.price : medPrice
    return { id: v.id, label: v.label, price }
  }

  const [variantPicker, setVariantPicker] = useState<{
    med: Product
    variants: CatalogVariant[]
  } | null>(null)

  /** Add a med to the cart, or open the variant picker when it has variants. */
  function addMedOrPick(
    med: Product,
    variants: CatalogVariant[] | undefined,
  ): ScanFeedback {
    const vs = variants ?? []
    if (vs.length > 0) {
      setVariantPicker({ med, variants: vs })
      return { ok: true, message: "اختر النوع" }
    }
    addWithFeedback(med)
    return { ok: true, message: `أُضيف: ${med.name}` }
  }

  /** Camera scan → straight into the cart (sound + flash handled by the
   *  scanner based on `ok`: chirp when added, red flash + buzz otherwise). */
  async function handleScan(code: string): Promise<ScanFeedback> {
    // Instant path: local catalogue hit, no network round-trip.
    const hit = byBarcode.get(code.trim())
    if (hit) {
      if (hit.variant) {
        addWithFeedback(catalogToMed(hit.med), variantToCart(hit.variant, hit.med.price))
        return {
          ok: true,
          message: `أُضيف: ${hit.med.name} — ${hit.variant.label}`,
        }
      }
      return addMedOrPick(catalogToMed(hit.med), hit.med.variants)
    }
    try {
      // Fallback: exact (indexed) barcode lookup, then fuzzy search.
      const exact = await productsList({ barcode: code, page_size: 1 })
      const found = (exact.data.results ?? [])[0]
      if (found) {
        return addMedOrPick(found, medVariants(found))
      }
      if (catalogReady) {
        return { ok: false, message: "غير موجود — لم تتم الإضافة" }
      }
      const r = await productsList({ search: code, page_size: 2 })
      const results = r.data.results ?? []
      if (results.length === 1) {
        return addMedOrPick(results[0], medVariants(results[0]))
      }
      if (results.length === 0) {
        return { ok: false, message: "غير موجود — لم تتم الإضافة" }
      }
    } catch {
      /* fall through to plain search */
    }
    setSearchRaw(code)
    return { ok: false, message: "نتائج متعددة — اختر من القائمة" }
  }

  /** Hardware (keyboard-wedge) scanner: types the code then sends Enter. */
  async function handleWedgeEnter(value: string) {
    const hit = byBarcode.get(value.trim())
    if (hit) {
      if (hit.variant) {
        addWithFeedback(catalogToMed(hit.med), variantToCart(hit.variant, hit.med.price))
      } else {
        addMedOrPick(catalogToMed(hit.med), hit.med.variants)
      }
      setSearchRaw("")
      return
    }
    try {
      const r = await productsList({ search: value, page_size: 2 })
      const results = r.data.results ?? []
      if (
        results.length === 1 ||
        (results.length > 0 && results[0].barcode === value)
      ) {
        addMedOrPick(results[0], medVariants(results[0]))
        setSearchRaw("")
        return
      }
      if (results.length === 0) {
        playBeep(false)
        toast.error("لا توجد نتيجة لهذا الباركود")
        return
      }
      // Ambiguous — surface the matches so the cashier can pick one.
      setSearchRaw(value)
    } catch {
      setSearchRaw(value)
    }
  }

  const activeCount = pos.active?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0
  const activeTotal = pos.active ? cartTotal(pos.active) : 0

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            نقطة البيع
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            مبيعات اليوم:{" "}
            <span className="font-bold text-foreground">
              {stats?.periods?.today
                ? formatMoney(stats.periods.today.amount)
                : "…"}
            </span>{" "}
            <span className="pill pill-primary ms-1 px-2 py-0.5 text-[10px]">
              {stats?.periods?.today
                ? formatNumber(stats.periods.today.count)
                : "…"}{" "}
              عملية
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Print settings (paper size, logo, auto-print) */}
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            title="طباعة فاتورة"
            aria-label="طباعة فاتورة"
            className="grid size-9 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border transition hover:ring-primary/40"
          >
            <Printer className="size-4.5" />
          </button>
          {/* Sound on/off */}
          <button
            type="button"
            onClick={() => {
              const next = !muted
              setMuted(next)
              setMutedState(next)
              if (!next) playBeep(true) // preview
            }}
            aria-pressed={muted}
            title={muted ? "تشغيل الصوت" : "كتم الصوت"}
            className={cn(
              "grid size-9 place-items-center rounded-full shadow-sm ring-1 transition",
              muted
                ? "bg-muted text-muted-foreground ring-border"
                : "bg-card text-primary ring-border hover:ring-primary/40",
            )}
          >
            {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </button>
          {/* Mode switch */}
          <div className="flex items-center rounded-full bg-card p-1 shadow-sm ring-1 ring-border">
            {(
              [
                { value: "grid", label: "شبكة", icon: LayoutGrid },
                { value: "table", label: "جدول", icon: TableProperties },
              ] as const
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => switchMode(m.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mode === m.value
                    ? "bg-ink text-white shadow-md shadow-ink/25"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icon className="size-3.5" />
                {m.label}
              </button>
            ))}
          </div>
          <Link
            href="/sales"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium shadow-sm transition hover:border-primary/40 hover:text-primary md:hidden"
          >
            <ChartColumn className="size-4" />
            المبيعات
          </Link>
        </div>
      </div>

      {mode === "table" ? (
        <TableMode
          pos={pos}
          searchRaw={searchRaw}
          setSearchRaw={setSearchRaw}
          onScanCode={handleScan}
          onWedgeEnter={handleWedgeEnter}
          catalog={catalog}
          onPick={(m) => {
            addMedOrPick(catalogToMed(m), medVariants(m))
            setSearchRaw("")
          }}
          onSubmitSale={submitActiveSale}
        />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
            {/* Products */}
            <div className="min-w-0" data-tour="pos-search">
              {/* Kept inside the products column so it never slides over the cart. */}
              <StickyToolbar className="lg:-mx-2 lg:px-2">
                <SearchInput
                  value={searchRaw}
                  onChange={setSearchRaw}
                  placeholder="ابحث أو امسح الباركود لإضافة منتج…"
                  scan
                  onScan={handleScan}
                  scanContinuous
                  onEnter={handleWedgeEnter}
                  onScanClick={() => {
                    // On mobile, scanning happens inside the cart sheet —
                    // camera on top, items landing live underneath.
                    if (window.innerWidth < 1024) {
                      setSheetScan(true)
                      setCartOpen(true)
                      return true
                    }
                  }}
                  scanStatus={
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShoppingBag className="size-4" />
                        {formatNumber(activeCount)} صنف
                      </span>
                      <span className="font-heading text-lg font-bold">
                        {formatMoney(activeTotal)}
                      </span>
                    </div>
                  }
                />
              </StickyToolbar>

              {isLoading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-3xl" />
                  ))}
                </div>
              )}
              {isError && <ErrorState onRetry={() => refetch()} />}
              {!isLoading && !isError && items.length === 0 && (
                <EmptyState
                  art={<NoMedsArt className="h-32 w-auto" />}
                  title="لا توجد نتائج"
                  description="جرّب اسماً آخر أو امسح الباركود"
                />
              )}
              {items.length > 0 && (
                <>
                  <div
                    ref={scope}
                    className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 lg:pb-0 xl:grid-cols-4"
                  >
                    {items.map((m) => (
                      <ProductTile
                        key={m.id}
                        med={m}
                        onAdd={(med) => addMedOrPick(med, medVariants(med))}
                      />
                    ))}
                  </div>
                  <LoadMore
                    hasNext={Boolean(hasNextPage)}
                    isFetchingNext={isFetchingNextPage}
                    onLoad={() => fetchNextPage()}
                  />
                </>
              )}
            </div>

            {/* Cart — desktop side panel */}
            <div className="relative z-30 hidden lg:block" data-tour="pos-cart">
              <Card
                className={cn(
                  // Height accounts for the top bar + page header so the
                  // checkout button never slips below the fold.
                  "sticky top-2 flex max-h-[calc(100dvh-13.5rem)] min-h-0 flex-col gap-0 overflow-hidden p-4",
                  bumping && "cart-bump",
                  pos.active?.isReturn && "return-glow",
                )}
              >
                <CartPanel
                  pos={pos}
                  onScanBurst={(code) => void handleWedgeEnter(code)}
                  onSubmitSale={submitActiveSale}
                />
              </Card>
            </div>
          </div>

          {/* Cart — mobile: compact FAB while empty, full bar once it has items */}
          <div className="fixed inset-x-3 bottom-24 z-30 lg:hidden">
            {activeCount === 0 && pos.carts.length === 1 ? (
              <button
                type="button"
                onClick={() => {
                  // Open the cart with the barcode scanner already running.
                  setSheetScan(true)
                  setCartOpen(true)
                }}
                aria-label="السلة"
                className="ink-panel animate-in zoom-in-75 ms-auto grid size-14 place-items-center rounded-full text-white shadow-2xl transition duration-200 active:scale-95"
              >
                <ShoppingBag className="size-6" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Open the cart with the barcode scanner already running.
                  setSheetScan(true)
                  setCartOpen(true)
                }}
                className={cn(
                  "ink-panel animate-in fade-in zoom-in-95 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-white shadow-2xl transition duration-200 active:scale-[0.99]",
                  bumping && "cart-bump",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="relative">
                    <ShoppingBag className="size-5" />
                    {activeCount > 0 && (
                      <span className="absolute -end-2 -top-2 grid size-4.5 place-items-center rounded-full bg-lime text-[10px] font-bold text-lime-foreground">
                        {formatNumber(activeCount)}
                      </span>
                    )}
                  </span>
                  السلة
                  {pos.carts.length > 1 && (
                    <span className="pill bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                      {formatNumber(pos.carts.length)} سلال
                    </span>
                  )}
                </span>
                <span className="font-heading text-lg font-bold text-lime">
                  {formatMoney(activeTotal)}
                </span>
              </button>
            )}
          </div>
          <Dialog open={cartOpen} onOpenChange={setCartOpen}>
            {/* Bottom sheet: fixed height, internal scroll — actions always visible. */}
            <DialogContent
              showCloseButton={false}
              className={cn(
                "top-auto bottom-0 left-0 h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl data-closed:zoom-out-100 data-open:zoom-in-100 data-open:slide-in-from-bottom-10 flex flex-col gap-0 overflow-hidden p-4 pt-5",
                pos.active?.isReturn && "return-glow",
              )}
            >
              <DialogTitle className="sr-only">السلة</DialogTitle>
              <CartPanel
                pos={pos}
                totalOnTop
                onScanCode={handleScan}
                defaultScanning={sheetScan}
                onDone={() => setCartOpen(false)}
                onScanBurst={(code) => void handleWedgeEnter(code)}
                onSubmitSale={submitActiveSale}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      <PrintReceiptDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        onOpenSettings={() => {
          setPrintOpen(false)
          setPrintSettingsOpen(true)
        }}
      />
      <PrintSettingsDialog
        open={printSettingsOpen}
        onOpenChange={setPrintSettingsOpen}
      />
      <Dialog
        open={variantPicker !== null}
        onOpenChange={(o) => !o && setVariantPicker(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{variantPicker?.med.name} — اختر النوع</DialogTitle>
          <div className="mt-2 grid gap-2">
            {variantPicker?.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  if (variantPicker)
                    addWithFeedback(
                      variantPicker.med,
                      variantToCart(v, variantPicker.med.price ?? "0"),
                    )
                  setVariantPicker(null)
                }}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition hover:bg-primary/5 active:scale-[0.99]"
              >
                {(() => {
                  const swatches = Object.values(v.attributes ?? {})
                    .map((raw) => colorHexOf(String(raw)))
                    .filter((hex): hex is string => Boolean(hex))
                  return swatches.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-1">
                      {swatches.map((hex, idx) => (
                        <span
                          key={`${hex}-${idx}`}
                          className="size-4 rounded-full border"
                          style={{ background: hex }}
                        />
                      ))}
                    </span>
                  ) : null
                })()}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {v.label}
                </span>
                <span
                  className={`pill ${
                    Number(v.stock) <= 0
                      ? "pill-danger"
                      : Number(v.stock) <= 5
                        ? "pill-warning"
                        : "pill-neutral"
                  }`}
                >
                  {formatNumber(Number(v.stock))}
                </span>
                <span className="shrink-0 font-heading text-sm font-bold text-primary tabular-nums">
                  {formatMoney(
                    Number(v.price) > 0 ? v.price : (variantPicker?.med.price ?? 0),
                  )}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
