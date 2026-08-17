"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Check,
  Loader2,
  Printer,
  ReceiptText,
  Settings2,
  SlidersHorizontal,
} from "lucide-react"

import { salesList, type Sale } from "@/api/sales"
import { useMe, displayName } from "@/hooks/use-me"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { printReceipt, type ReceiptData } from "@/lib/print/receipt"
import { loadPrintSettings } from "@/lib/print/settings"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchInput } from "@/components/search-input"
import {
  SaleFiltersPanel,
  activeSaleFilterCount,
  EMPTY_SALE_FILTERS,
  type SaleFilters,
} from "@/components/sales/sale-filters-panel"

function saleToReceipt(s: Sale, cashierFallback: string): ReceiptData {
  return {
    saleId: s.id,
    items: s.items.map((it) => ({
      name: it.medication_name || "—",
      quantity: it.quantity,
      unitPrice: it.unit_price,
      lineTotal: it.line_total,
    })),
    total: toNumber(s.total),
    discountedTotal: toNumber(s.discounted_total),
    paymentMethod: s.payment_method,
    isReturn: Boolean(s.is_return),
    customerName: s.customer_name,
    cashierName: s.created_by_name || cashierFallback,
    createdAt: s.created_at,
  }
}

export function PrintReceiptDialog({
  open,
  onOpenChange,
  onOpenSettings,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onOpenSettings?: () => void
}) {
  const { user } = useMe()
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "فارما"
  const pharmacyLogo = me?.pharmacy_logo || ""
  const cashierName = displayName(user)

  const [showFilters, setShowFilters] = useState(false)
  // Toolbar search = product name OR barcode (drives the `item` param).
  const [item, setItem] = useState("")
  const [f, setF] = useState<SaleFilters>(EMPTY_SALE_FILTERS)
  const [selected, setSelected] = useState<number | null>(null)
  // Did the cashier tap a specific row? If not, we always follow the newest
  // sale as the list refreshes (so a just-made sale can't be missed).
  const [userPicked, setUserPicked] = useState(false)
  const patch = (p: Partial<SaleFilters>) => setF((prev) => ({ ...prev, ...p }))

  const dItem = useDebounced(item, 300)

  const params = useMemo(
    () => ({
      ordering: "-created_at",
      page_size: 10,
      item: dItem || undefined,
      customer: f.customer || undefined,
      created_after: f.dateFrom || undefined,
      created_before: f.dateTo || undefined,
      min_price: f.minPrice || undefined,
      max_price: f.maxPrice || undefined,
      created_by: f.employee || undefined,
      payment_method: f.payment || undefined,
    }),
    [dItem, f.customer, f.dateFrom, f.dateTo, f.minPrice, f.maxPrice, f.employee, f.payment],
  )

  // Key is under the shared "sales" prefix so every sales invalidation (POS
  // checkout, voiding a sale) refreshes this picker too. staleTime 0 means
  // opening always shows the latest.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sales", "print", params],
    queryFn: async () => (await salesList(params)).data.results,
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })
  const sales = useMemo(() => data ?? [], [data])

  // Each time the dialog opens: default to the newest and pull fresh data.
  useEffect(() => {
    if (!open) return
    setUserPicked(false)
    setSelected(null)
    void refetch()
  }, [open, refetch])

  // Keep the selection on the newest sale unless the cashier picked one.
  useEffect(() => {
    if (sales.length === 0) return setSelected(null)
    if (!userPicked || !sales.some((s) => s.id === selected)) {
      setSelected(sales[0].id)
    }
  }, [sales, selected, userPicked])

  // Accumulate employee options so the list doesn't collapse when filtering.
  const [empOpts, setEmpOpts] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    if (sales.length === 0) return
    setEmpOpts((prev) => {
      const next = new Map(prev)
      for (const s of sales) if (s.created_by != null) next.set(s.created_by, s.created_by_name || "—")
      return next
    })
  }, [sales])

  const activeCount = activeSaleFilterCount(f)

  function doPrint() {
    const s = sales.find((x) => x.id === selected)
    if (!s) return
    printReceipt(saleToReceipt(s, cashierName), pharmacyName, loadPrintSettings(), pharmacyLogo)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>طباعة فاتورة</DialogTitle>
            {onOpenSettings && (
              <Button
                variant="ghost"
                size="sm"
                className="me-6 text-muted-foreground"
                onClick={onOpenSettings}
              >
                <Settings2 className="size-4" />
                إعدادات
              </Button>
            )}
          </div>
          <DialogDescription>اختر عملية بيع لطباعة إيصالها — الأحدث محدّدة تلقائياً.</DialogDescription>
        </DialogHeader>

        {/* Toolbar: product name / barcode search (+ scan) */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchInput
              value={item}
              onChange={setItem}
              placeholder="ابحث بالصنف أو الباركود…"
              scan
            />
          </div>
          <Button
            variant={showFilters || activeCount ? "default" : "outline"}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-4" />
            تصفية
            {activeCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[11px] font-bold">
                {activeCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filters (customer dropdown + dates/price/employee/payment) */}
        {showFilters && (
          <SaleFiltersPanel
            f={f}
            patch={patch}
            empOpts={empOpts}
            onClear={() => setF(EMPTY_SALE_FILTERS)}
          />
        )}

        {/* Sales list */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {isLoading && (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {isError && (
            <div className="grid place-items-center py-10 text-sm text-destructive">تعذّر تحميل المبيعات</div>
          )}
          {!isLoading && !isError && sales.length === 0 && (
            <div className="grid place-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <ReceiptText className="size-7 opacity-40" />
              لا توجد مبيعات مطابقة
            </div>
          )}
          {sales.map((s) => {
            const isSel = s.id === selected
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelected(s.id)
                  setUserPicked(true)
                }}
                onDoubleClick={doPrint}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition",
                  isSel
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/30",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border",
                    isSel ? "border-primary bg-primary text-white" : "border-muted-foreground/40",
                  )}
                >
                  {isSel && <Check className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {s.customer_name || "زبون نقدي"}
                    </span>
                    <span
                      className={cn(
                        "pill px-2 py-0.5 text-[10px]",
                        s.is_return ? "pill-danger" : s.payment_method === "cash" ? "pill-success" : "pill-warning",
                      )}
                    >
                      {s.is_return ? "إرجاع" : s.payment_method === "cash" ? "نقدي" : "دين"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    #{s.id} · {formatNumber(s.items.length)} صنف · {s.created_by_name || "—"} · {formatDate(s.created_at)}
                  </div>
                </div>
                <span className="font-heading text-sm font-bold tabular-nums">
                  {formatMoney(s.discounted_total)}
                </span>
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button onClick={doPrint} disabled={selected == null}>
            <Printer className="size-4" />
            طباعة الإيصال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
