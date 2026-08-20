"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { toast } from "sonner"
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  CloudOff,
  Package,
  Pencil,
  Printer,
  ReceiptText,
  SlidersHorizontal,
  Trash2,
  UserCog,
  User as UserIcon,
} from "lucide-react"

import {
  salesList,
  salesDelete,
  salesStats,
  saleItemName,
  type Sale,
} from "@/api/sales"
import { usePagedList } from "@/hooks/use-paged-list"
import { useDebounced } from "@/hooks/use-debounced"
import { useMe, displayName } from "@/hooks/use-me"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { type ReceiptData } from "@/lib/print/receipt"
import { deliverAndToast } from "@/lib/print/deliver"
import { loadPrintSettings } from "@/lib/print/settings"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useIsOwner } from "@/lib/modules"
import {
  LOCAL_SALE_LABEL,
  isLocalSale,
  saleNumberLabel,
} from "@/lib/offline/local-sale"
import { bulkDeleteSales } from "@/api/products"

import { invalidateSaleData } from "@/lib/sale-queries"
import { DaySummaryCards } from "@/components/sales/day-summary-cards"
import { SaleRevisions } from "@/components/sales/sale-revisions"
import { PageHeader } from "@/components/page-header"
import { ReportsTeaser } from "@/components/reports/reports-teaser"

gsap.registerPlugin(ScrollTrigger)
import { SearchInput } from "@/components/search-input"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { FilterMenu } from "@/components/filter-menu"
import { SortMenu, type SortOption } from "@/components/sort-menu"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  SaleFiltersPanel,
  activeSaleFilterCount,
  EMPTY_SALE_FILTERS,
  type SaleFilters,
} from "@/components/sales/sale-filters-panel"
import { PaginationBar } from "@/components/pagination-bar"
import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState, ErrorState } from "@/components/states"
import { NoDataArt } from "@/components/illustrations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 15

const SORTS: SortOption[] = [
  { value: "-created_at", label: "الأحدث" },
  { value: "created_at", label: "الأقدم" },
  { value: "-discounted_total", label: "الأعلى مبلغاً" },
  { value: "discounted_total", label: "الأقل مبلغاً" },
]

function PaymentPill({ sale }: { sale: Sale }) {
  if (sale.is_return) {
    return <span className="pill pill-danger">إرجاع</span>
  }
  return (
    <span
      className={cn(
        "pill",
        sale.payment_method === "cash" ? "pill-success" : "pill-warning",
      )}
    >
      {sale.payment_method === "cash" ? "نقدي" : "دين"}
    </span>
  )
}

/* ── Sale detail dialog ────────────────────────────────────────────── */
function SaleDetail({
  sale,
  open,
  onOpenChange,
  onVoid,
}: {
  sale: Sale | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onVoid: (s: Sale) => void
}) {
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "المتجر"
  const pharmacyLogo = me?.pharmacy_logo || ""

  function reprint(s: Sale) {
    const data: ReceiptData = {
      saleId: s.id,
      // Same number as the original receipt, so a reprint scans identically.
      receiptCode: s.receipt_code,
      items: s.items.map((it) => ({
        name: saleItemName(it),
        quantity: it.quantity,
        unitPrice: it.unit_price,
        lineTotal: it.line_total,
      })),
      total: toNumber(s.total),
      discountedTotal: toNumber(s.discounted_total),
      paymentMethod: s.payment_method,
      isReturn: Boolean(s.is_return),
      customerName: s.customer_name,
      cashierName: s.created_by_name || cashierName,
      createdAt: s.created_at,
    }
    // Agent → browser → file, same as a checkout.
    void deliverAndToast(
      data,
      pharmacyName,
      loadPrintSettings(),
      pharmacyLogo,
      "إعادة طباعة الفاتورة",
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl"
      >
        {sale && (
          <>
            {/* shrink-0: the dialog is a flex column with a max height, so a
                child without it gets SQUEEZED as the middle grows. Expanding
                the revision history crushed this header and hid قيمة البيع —
                the one number the owner opened the invoice to read. Only the
                middle section may give; the header and the footer are fixed. */}
            <div
              className="ink-panel shrink-0 rounded-none p-6"
              style={{ borderRadius: 0, boxShadow: "none" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="bg-brand-gradient grid size-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white ring-2 ring-white/20">
                    {sale.customer_name?.trim().charAt(0) || (
                      <UserIcon className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate font-heading text-lg font-bold text-white">
                      {sale.customer_name || "زبون نقدي"}
                    </DialogTitle>
                    {/* A queued sale has no server number yet — showing
                        "بيع رقم -1" would read as a data bug. */}
                    <p className="text-xs text-white/55">
                      {saleNumberLabel(sale.id, sale.receipt_code)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "pill",
                    sale.payment_method === "cash"
                      ? "bg-success/25 text-white"
                      : "bg-warning/25 text-white",
                  )}
                >
                  <Banknote className="size-3.5" />
                  {sale.payment_method === "cash" ? "نقدي" : "دين"}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                <div>
                  <p className="text-[11px] text-white/60">قيمة البيع</p>
                  <p className="font-heading text-2xl font-bold text-lime">
                    {formatMoney(sale.discounted_total)}
                  </p>
                </div>
                {toNumber(sale.discounted_total) !== toNumber(sale.total) && (
                  <p className="text-sm text-white/45 line-through">
                    {formatMoney(sale.total)}
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground">
                      التاريخ
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {formatDate(sale.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserCog className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground">
                      البائع
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {sale.created_by_name || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nothing at all on an untouched invoice, which is nearly all
                  of them. */}
              <SaleRevisions
                saleId={sale.id}
                count={sale.revision_count ?? 0}
                receiptCode={sale.receipt_code}
              />

              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">الصنف</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-end">السعر</TableHead>
                      <TableHead className="text-end">المجموع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((it, i) => (
                      <TableRow key={it.id ?? i}>
                        <TableCell className="max-w-[180px] truncate whitespace-normal font-medium">
                          {saleItemName(it)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatMoney(it.unit_price)}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums">
                          {formatMoney(it.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-t border-border/70 bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reprint(sale)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                >
                  <Printer className="size-4" />
                  طباعة الفاتورة
                </button>
                {/* Correct the sale instead of voiding and re-ringing it: the
                    receipt already in the customer's hand keeps pointing at the
                    right invoice, and the day's history shows one sale for one
                    basket. A queued sale has no server id yet, so there is
                    nothing to PATCH. */}
                <Link
                  href={isLocalSale(sale.id) ? "#" : `/pos?edit=${sale.id}`}
                  onClick={(e) => {
                    if (isLocalSale(sale.id)) {
                      e.preventDefault()
                      return
                    }
                    onOpenChange(false)
                  }}
                  aria-disabled={isLocalSale(sale.id)}
                  title={
                    isLocalSale(sale.id)
                      ? "لا يمكن تعديل بيع لم تتم مزامنته بعد — انتظر عودة الاتصال"
                      : "تعديل الفاتورة في نقطة البيع"
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-muted",
                    isLocalSale(sale.id) && "pointer-events-none opacity-40",
                  )}
                >
                  <Pencil className="size-4" />
                  تعديل
                </Link>
              </div>
              {/* Voiding PATCHes /sales/<id>/. A queued sale has no server id
                  yet, so the call would go out as -1. Fix it at the source in
                  the POS (or wait for the sync) instead. */}
              <button
                type="button"
                disabled={isLocalSale(sale.id)}
                title={
                  isLocalSale(sale.id)
                    ? "لا يمكن إلغاء بيع لم تتم مزامنته بعد — انتظر عودة الاتصال"
                    : undefined
                }
                onClick={() => {
                  onOpenChange(false)
                  onVoid(sale)
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                إلغاء البيع (استرجاع المخزون)
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function SalesPage() {
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [searchRaw, setSearchRaw] = useState("")
  const dItem = useDebounced(searchRaw, 300)
  const [payment, setPayment] = useState("all")
  const [kind, setKind] = useState("all")
  const [ordering, setOrdering] = useState("-created_at")
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Sale | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [toVoid, setToVoid] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [filters, setFilters] = useState<SaleFilters>(EMPTY_SALE_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const patch = (p: Partial<SaleFilters>) =>
    setFilters((prev) => ({ ...prev, ...p }))
  const [empOpts, setEmpOpts] = useState<Map<number, string>>(new Map())
  const scope = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPage(1)
  }, [
    dItem,
    filters.customer,
    payment,
    kind,
    ordering,
    filters.dateFrom,
    filters.dateTo,
    filters.minPrice,
    filters.maxPrice,
    filters.employee,
  ])

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => (await salesStats()).data,
    staleTime: 60_000,
  })

  const params = useMemo(
    () => ({
      payment_method: payment === "all" ? undefined : payment,
      is_return: kind === "all" ? undefined : kind === "return",
      ordering,
      item: dItem || undefined,
      customer: filters.customer || undefined,
      created_after: filters.dateFrom || undefined,
      created_before: filters.dateTo || undefined,
      min_price: filters.minPrice || undefined,
      max_price: filters.maxPrice || undefined,
      created_by: filters.employee || undefined,
    }),
    [
      payment,
      kind,
      ordering,
      dItem,
      filters.customer,
      filters.dateFrom,
      filters.dateTo,
      filters.minPrice,
      filters.maxPrice,
      filters.employee,
    ],
  )

  const { results, count, pageCount, isLoading, isError, isFetching, refetch } =
    usePagedList<Sale>(["sales"], salesList, params, page, PAGE_SIZE)

  useEffect(() => {
    if (results.length === 0) return
    setEmpOpts((prev) => {
      const next = new Map(prev)
      for (const s of results)
        if (s.created_by != null)
          next.set(s.created_by, s.created_by_name || "—")
      return next
    })
  }, [results])

  // Busy = first load, a fetch in flight, or a term typed/scanned that the
  // debounce has not sent yet. All three must hide the stale rows.
  const searching =
    isLoading || isFetching || searchRaw.trim() !== dItem.trim()

  useStaggerCards(scope, "tbody tr", !searching, [
    dItem,
    payment,
    kind,
    ordering,
    page,
  ])

  // Same bouncy scroll-triggered entrances as the reports page.
  useGSAP(
    () => {
      if (statsLoading) return
      gsap.utils.toArray<HTMLElement>(".sale-stat").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 40, opacity: 0, scale: 0.78 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.7,
            delay: i * 0.05,
            ease: "back.out(3)",
            overwrite: "auto",
            clearProps: "transform,opacity",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        )
      })
    },
    { scope, dependencies: [statsLoading] },
  )

  async function confirmVoid() {
    if (!toVoid) return
    setVoiding(true)
    try {
      await salesDelete(toVoid.id)
      toast.success("أُلغي البيع واستُرجع المخزون")
      invalidateSaleData(qc)
      setToVoid(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإلغاء")
    } finally {
      setVoiding(false)
    }
  }

  async function wipeAllSales() {
    setWiping(true)
    try {
      await bulkDeleteSales({ all: true })
      toast.success("حُذفت كل المبيعات واستُرجع المخزون")
      invalidateSaleData(qc)
      setWipeOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setWiping(false)
    }
  }

  const periodCards = stats
    ? ([
        ["اليوم", stats.periods.today],
        ["أمس", stats.periods.yesterday],
        ["آخر ٧ أيام", stats.periods.week],
        ["هذا الشهر", stats.periods.month],
        ["الشهر الماضي", stats.periods.last_month],
        ["الإجمالي", stats.periods.all_time],
      ] as const)
    : []

  const catTotal = stats
    ? stats.by_category.reduce((s, c) => s + toNumber(c.amount), 0)
    : 0
  const cashAmount = stats ? toNumber(stats.payment_split.cash) : 0
  const debtAmount = stats ? toNumber(stats.payment_split.debt) : 0
  const splitTotal = cashAmount + debtAmount

  return (
    <div ref={scope} className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="المبيعات"
        description={count ? `${formatNumber(count)} عملية بيع` : "سجل المبيعات وإحصاءاتها"}
        action={
          <div className="flex items-center gap-2">
            {/* Debts moved off the mobile bottom bar → reachable here (mobile only). */}
            <Link
              href="/debts"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5 md:hidden")}
            >
              <ReceiptText className="size-4" />
              الديون
            </Link>
            {isOwner && count ? (
              <Button variant="destructive" onClick={() => setWipeOpen(true)} className="gap-1.5">
                <Trash2 className="size-4" />
                حذف كل المبيعات
              </Button>
            ) : null}
          </div>
        }
      />

      {/* The three numbers the owner actually opens this page for: جوال,
          دخان, and the day's total — for the TRADING day, which rolls over at
          4am rather than midnight. Above everything else because he wants to
          walk past the screen and know. */}
      <div className="mb-4">
        <DaySummaryCards />
      </div>

      {/* Period totals */}
      {statsLoading && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      )}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {periodCards.map(([label, bucket]) => (
            <Card key={label} className="sale-stat clay-card border-0 gap-0 p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                {label}
              </p>
              <p className="mt-0.5 font-heading text-lg font-bold tracking-tight">
                {formatMoney(bucket.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatNumber(bucket.count)} عملية
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Reports module — live preview or the locked upsell teaser. */}
      <ReportsTeaser />

      {/* Category split + payment split (last 30 days).
          Collapsed: the owner does not read these, and they pushed the numbers
          he DOES read below the fold. Still one click away for whoever wants
          them. */}
      {stats && (stats.by_category.length > 0 || splitTotal > 0) && (
        <details className="group mb-5">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
            <ChevronDown className="size-4 transition group-open:rotate-180" />
            تحليلات آخر ٣٠ يوماً
          </summary>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="sale-stat clay-card border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">المبيعات حسب التصنيف</CardTitle>
              <span className="pill pill-neutral">آخر ٣٠ يوماً</span>
            </CardHeader>
            <CardContent>
              {stats.by_category.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <NoDataArt className="h-20 w-auto" />
                  <p className="text-sm text-muted-foreground">لا مبيعات بعد</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {stats.by_category.map((c) => {
                    const amount = toNumber(c.amount)
                    const pct = catTotal ? Math.round((amount / catTotal) * 100) : 0
                    return (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 truncate text-sm text-muted-foreground">
                          {c.category}
                        </span>
                        <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-muted">
                          <div
                            className="absolute inset-y-0 start-0 rounded-lg"
                            style={{
                              width: `${Math.max(pct, 3)}%`,
                              backgroundImage:
                                "linear-gradient(90deg, var(--chart-1), var(--chart-3))",
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-end text-xs font-bold tabular-nums">
                          {pct}٪
                        </span>
                        <span className="hidden w-16 shrink-0 text-end text-xs text-muted-foreground tabular-nums sm:block">
                          {formatNumber(toNumber(c.qty ?? 0))} قطعة
                        </span>
                        <span className="hidden w-20 shrink-0 text-end text-xs text-muted-foreground tabular-nums sm:block">
                          {formatMoney(amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="sale-stat clay-card border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">نقدي مقابل دين</CardTitle>
              <span className="pill pill-neutral">آخر ٣٠ يوماً</span>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              {splitTotal === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <NoDataArt className="h-20 w-auto" />
                  <p className="text-sm text-muted-foreground">لا مبيعات بعد</p>
                </div>
              ) : (
                <>
                  <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-chart-4"
                      style={{ width: `${(cashAmount / splitTotal) * 100}%` }}
                    />
                    <div
                      className="bg-chart-5"
                      style={{ width: `${(debtAmount / splitTotal) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full bg-chart-4" />
                      نقدي
                      <b className="tabular-nums">{formatMoney(cashAmount)}</b>
                      <span className="pill pill-neutral px-2 py-0.5 text-[10px]">
                        {Math.round((cashAmount / splitTotal) * 100)}٪
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full bg-chart-5" />
                      دين
                      <b className="tabular-nums">{formatMoney(debtAmount)}</b>
                      <span className="pill pill-neutral px-2 py-0.5 text-[10px]">
                        {Math.round((debtAmount / splitTotal) * 100)}٪
                      </span>
                    </span>
                  </div>
                  {/* 14-day mini bars — anchored to the card bottom */}
                  <div className="mt-auto flex min-h-24 flex-1 items-end gap-1 border-b-2 border-border/70 pb-0">
                    {stats.daily.map((d) => {
                      const max = Math.max(
                        ...stats.daily.map((x) => toNumber(x.amount)),
                        1,
                      )
                      return (
                        <div
                          key={d.date}
                          title={`${d.date}: ${formatMoney(d.amount)}`}
                          className="bg-brand-gradient flex-1 rounded-t-md opacity-80"
                          style={{
                            height: `${Math.max((toNumber(d.amount) / max) * 100, 4)}%`,
                          }}
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </details>
      )}

      {/* History */}
      <StickyToolbar>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="امسح باركود الفاتورة أو ابحث بالصنف…"
            className="flex-1"
            scan
          />
          <Button
            type="button"
            variant={
              showFilters || activeSaleFilterCount(filters, { ignorePayment: true })
                ? "default"
                : "outline"
            }
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">تصفية</span>
            {activeSaleFilterCount(filters, { ignorePayment: true }) > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[11px] font-bold">
                {activeSaleFilterCount(filters, { ignorePayment: true })}
              </span>
            )}
          </Button>
          <FilterMenu
            groups={[
              {
                label: "طريقة الدفع",
                value: payment,
                onChange: setPayment,
                options: [
                  { value: "all", label: "الكل" },
                  { value: "cash", label: "نقدي" },
                  { value: "debt", label: "دين" },
                ],
              },
              {
                label: "النوع",
                value: kind,
                onChange: setKind,
                options: [
                  { value: "all", label: "الكل" },
                  { value: "sale", label: "بيع" },
                  { value: "return", label: "إرجاع" },
                ],
              },
            ]}
          />
          <SortMenu value={ordering} options={SORTS} onChange={setOrdering} />
        </div>
      </StickyToolbar>

      {showFilters && (
        <div className="mb-3">
          <SaleFiltersPanel
            f={filters}
            patch={patch}
            empOpts={empOpts}
            onClear={() => setFilters(EMPTY_SALE_FILTERS)}
            showPayment={false}
          />
        </div>
      )}

      {/*
        Hide the rows WHILE searching, not only on the first load.
        React Query keeps the previous page during a refetch, so scanning a
        receipt left the old sales on screen with no sign anything was
        happening — the cashier could not tell whether the scan had registered
        or whether those rows were the answer.
      */}
      {searching && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!searching && !isError && results.length === 0 && (
        <EmptyState
          art={<NoDataArt className="h-32 w-auto" />}
          title="لا توجد مبيعات"
          description="أتمم أول عملية بيع من نقطة البيع"
        />
      )}
      {!searching && !isError && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div data-slot="card" className="clay-card overflow-hidden rounded-3xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-start">الزبون</TableHead>
                  <TableHead className="hidden text-start sm:table-cell">
                    الأصناف
                  </TableHead>
                  <TableHead className="text-end">المبلغ</TableHead>
                  <TableHead className="text-center">الدفع</TableHead>
                  <TableHead className="hidden text-start sm:table-cell">
                    التاريخ
                  </TableHead>
                  <TableHead className="hidden text-start md:table-cell">
                    البائع
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((s) => (
                  <TableRow
                    key={s.id}
                    onClick={() => {
                      setDetail(s)
                      setDetailOpen(true)
                    }}
                    className="cursor-pointer transition-colors hover:bg-primary/4"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                          {s.customer_name?.trim().charAt(0) || (
                            <ReceiptText className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold">
                              {s.customer_name || "زبون نقدي"}
                            </span>
                            {isLocalSale(s.id) && (
                              <span
                                className="pill pill-warning shrink-0 gap-1 text-[10px]"
                                title="بيع تم أثناء انقطاع الاتصال — سيُرفع تلقائياً عند عودة الشبكة"
                              >
                                <CloudOff className="size-3" />
                                {LOCAL_SALE_LABEL}
                              </span>
                            )}
                            {/* Visible in the LIST, not only after opening the
                                invoice: an edited sale is the one an owner
                                scanning the day's takings needs to spot. */}
                            {(s.revision_count ?? 0) > 0 && (
                              <span
                                className="pill pill-warning shrink-0 gap-1 text-[10px]"
                                title={`عُدّلت ${s.revision_count} مرة — افتح الفاتورة لعرض النسخ السابقة`}
                              >
                                <Pencil className="size-3" />
                                معدّلة
                              </span>
                            )}
                          </div>
                          {s.customer_phone && (
                            <div
                              className="truncate text-xs text-muted-foreground"
                              dir="ltr"
                            >
                              {s.customer_phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Package className="size-3.5" />
                        {formatNumber(s.items.length)} صنف
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <span
                        className={cn(
                          "font-heading font-bold tabular-nums",
                          s.is_return && "text-destructive",
                        )}
                      >
                        {s.is_return ? "−" : ""}
                        {formatMoney(s.discounted_total)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <PaymentPill sale={s} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(s.created_at)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {s.created_by_name || "—"}
                    </TableCell>
                    <TableCell className="w-10 p-0 pe-2">
                      {/* Straight to the till. stopPropagation because the row
                          itself opens the detail dialog — without it the pencil
                          would navigate AND leave a dialog open behind it. */}
                      {!isLocalSale(s.id) && (
                        <Link
                          href={`/pos?edit=${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="تعديل الفاتورة"
                          aria-label="تعديل الفاتورة"
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground/60 transition hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            count={count}
            onPage={setPage}
            loading={isFetching}
          />
        </div>
      )}

      <SaleDetail
        sale={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onVoid={(s) => setToVoid(s)}
      />
      <ConfirmDelete
        open={Boolean(toVoid)}
        onOpenChange={(o) => !o && setToVoid(null)}
        onConfirm={confirmVoid}
        loading={voiding}
        title="إلغاء البيع"
        description="سيُلغى البيع، يُسترجع المخزون، ويُحذف الدين المرتبط به إن وُجد."
      />
      <ConfirmDelete
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        onConfirm={wipeAllSales}
        loading={wiping}
        title="حذف كل المبيعات"
        description="سيتم حذف جميع عمليات البيع نهائياً واسترجاع المخزون المرتبط بها. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف الكل"
      />
    </div>
  )
}
