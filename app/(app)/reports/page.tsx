"use client"

/**
 * التقارير والتحليلات — two tabs, two paid modules:
 *   المخزون  -> "reports"        (inventory issues, categories, valuation)
 *   المبيعات -> "sales_reports"  (deep sales analytics, separate permission)
 *
 * Kept deliberately simple: quick-filter cards, the table right below them
 * (infinite scroll), advanced filters tucked behind one button. GSAP +
 * ScrollTrigger entrances; KPI cards jump + tilt on pick.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  Barcode,
  Boxes,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  CalendarX2,
  CaseSensitive,
  ChartColumn,
  ChartPie,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileQuestion,
  FolderX,
  Loader2,
  Lock,
  PackageX,
  Ruler,
  ScanBarcode,
  Sparkles,
  SlidersHorizontal,
  Tag,
  TrendingDown,
  Wand2,
  X,
} from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { toast } from "sonner"

import {
  ISSUE_LABELS,
  barcodeProblem,
  downloadReport,
  reportsFilteredCharts,
  reportsProducts,
  reportsSummary,
  type CategoryBreakdown,
  type ReportIssueKey,
} from "@/api/reports"
import { productsRetrieve } from "@/api/generated/products/products"
import type { Product } from "@/api/generated/model"
import { BulkEditDialog } from "@/components/bulk-edit-dialog"
import { MedicationForm } from "@/components/forms/product-form"
import { hasModule, useIsOwner, useModules } from "@/lib/modules"
import { useDebounced } from "@/hooks/use-debounced"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PageHeader } from "@/components/page-header"
import { LockedReportsTeaser } from "@/components/reports/reports-teaser"
import { SalesTab } from "@/components/reports/sales-tab"
import { ScanTab } from "@/components/reports/scan-tab"
import { SearchInput } from "@/components/search-input"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

gsap.registerPlugin(ScrollTrigger)

const DAY_OPTIONS = [7, 30, 90] as const
const PAGE_SIZE = 30

const ISSUE_ICONS: Record<ReportIssueKey, typeof PackageX> = {
  zero_price: PackageX,
  below_cost: TrendingDown,
  zero_cost: Tag,
  negative_stock: AlertTriangle,
  out_of_stock: PackageX,
  low_stock: Boxes,
  dead_stock: ChartPie,
  expired: CalendarX2,
  expiring_soon: CalendarClock,
  no_expiry: CalendarOff,
  broken_barcode: Barcode,
  duplicate_barcode: Copy,
  no_category: FolderX,
  no_name: FileQuestion,
  name_no_letters: CaseSensitive,
  name_length: Ruler,
}

/** Related filters grouped so the KPI strip reads in one compact row of
 *  clusters instead of three loose rows (and scales as we add more). */
const ISSUE_GROUPS: { label: string; keys: ReportIssueKey[] }[] = [
  { label: "التسعير", keys: ["zero_price", "below_cost", "zero_cost"] },
  {
    label: "المخزون",
    keys: ["negative_stock", "out_of_stock", "low_stock", "dead_stock"],
  },
  { label: "الصلاحية", keys: ["expired", "expiring_soon", "no_expiry"] },
  { label: "الباركود", keys: ["broken_barcode", "duplicate_barcode"] },
  {
    label: "جودة البيانات",
    keys: ["no_category", "no_name", "name_no_letters", "name_length"],
  },
]

const groupOfIssue = (k: ReportIssueKey) =>
  ISSUE_GROUPS.find((g) => g.keys.includes(k))?.label ?? ISSUE_GROUPS[0].label

/** Which form field the current filter flags — spotlighted in the edit modal. */
const ISSUE_HIGHLIGHT: Partial<Record<ReportIssueKey, string>> = {
  zero_price: "price",
  below_cost: "price",
  zero_cost: "cost",
  negative_stock: "stock",
  out_of_stock: "stock",
  low_stock: "stock",
  dead_stock: "stock",
  expired: "expiry",
  expiring_soon: "expiry",
  no_expiry: "expiry",
  broken_barcode: "barcode",
  duplicate_barcode: "barcode",
  no_category: "category",
  no_name: "name",
  name_no_letters: "name",
  name_length: "name",
}

const PIE_COLORS = [
  "var(--primary)",
  "color-mix(in oklab, var(--primary) 75%, white)",
  "color-mix(in oklab, var(--primary) 55%, white)",
  "color-mix(in oklab, var(--primary) 38%, white)",
  "color-mix(in oklab, var(--primary) 24%, white)",
  "color-mix(in oklab, var(--primary) 65%, black)",
  "color-mix(in oklab, var(--primary) 45%, black)",
  "color-mix(in oklab, var(--primary) 85%, white)",
  "color-mix(in oklab, var(--primary) 30%, white)",
  "color-mix(in oklab, var(--primary) 15%, white)",
  "color-mix(in oklab, var(--primary) 50%, white)",
  "color-mix(in oklab, var(--primary) 70%, white)",
]

type SortKey = "name" | "price" | "cost" | "stock"

/** Categories pie — click a slice to pin its full breakdown beside it. */
function CategoriesCard({ categories }: { categories: CategoryBreakdown[] }) {
  const [selected, setSelected] = useState<CategoryBreakdown | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  function pick(c: CategoryBreakdown) {
    // Clicking the pinned category again clears it (back to the legend).
    if (selected?.name === c.name) {
      setSelected(null)
      return
    }
    setSelected(c)
    if (detailRef.current) {
      gsap.fromTo(
        detailRef.current,
        { scale: 0.86, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(2.6)" },
      )
    }
  }

  // Clicking anywhere outside the card returns it to the legend view.
  useEffect(() => {
    if (!selected) return
    const onDown = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setSelected(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [selected])

  const total = categories.reduce((s, c) => s + c.count, 0) || 1
  // Fixed top-6 legend so the card never jumps/grows as filters change the mix.
  const legend = categories.slice(0, 6)

  return (
    <div ref={cardRef} className="clay-card rep-cats p-5">
      <h3 className="font-heading mb-1 text-base font-bold">
        الأصناف حسب التصنيف
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        مرّر للتفاصيل — اضغط على أي شريحة لتثبيت ملخصها
      </p>
      <div className="flex flex-col items-center gap-4">
        <div className="clay-chart h-56 w-56 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="count"
                nameKey="name"
                innerRadius={46}
                outerRadius={86}
                paddingAngle={2}
                strokeWidth={0}
                animationDuration={900}
                onClick={(_, idx) => pick(categories[idx])}
                className="cursor-pointer"
                labelLine={false}
                // HOW MANY per category, right on the slice (big slices only).
                label={({ percent, payload, x, y }) =>
                  (percent ?? 0) >= 0.06 ? (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-foreground font-mono text-[10px] font-bold"
                    >
                      {formatNumber((payload as CategoryBreakdown).count)}
                    </text>
                  ) : null
                }
              >
                {categories.map((c, i) => (
                  <Cell key={c.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full">
          {selected ? (
            <div ref={detailRef} className="clay-well h-full p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-heading text-base font-bold">
                  {selected.name}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="pill pill-neutral text-[10px]">
                    {Math.round((selected.count / total) * 100)}٪ من الأصناف
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="إغلاق"
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">عدد الأصناف</span>
                  <b>{formatNumber(selected.count)}</b>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">متوفر</span>
                  <b>{formatNumber(selected.in_stock)}</b>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الأرخص</span>
                  <b className="font-mono">{formatMoney(selected.cheapest)}</b>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الأغلى</span>
                  <b className="font-mono">{formatMoney(selected.priciest)}</b>
                </p>
                <p className="col-span-2 flex justify-between gap-2 border-t pt-2">
                  <span className="text-muted-foreground">قيمة المخزون (بيع)</span>
                  <b className="font-mono">{formatMoney(selected.stock_value)}</b>
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
              {legend.map((c, i) => (
                <li key={c.name}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-start transition hover:bg-muted/60"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate">{c.name}</span>
                    <span className="ms-auto font-mono text-muted-foreground">
                      {formatNumber(c.count)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Inventory snapshot as a VISUAL — donut of availability + value bars. */
function ValuationChart({
  valuation,
}: {
  valuation: {
    total_medications: number
    in_stock: number
    stock_cost_value: string
    stock_retail_value: string
    potential_profit: string
  }
}) {
  const inStock = valuation.in_stock
  const outStock = Math.max(valuation.total_medications - inStock, 0)
  const donut = [
    { name: "متوفرة", value: inStock },
    { name: "غير متوفرة", value: outStock },
  ]
  const cost = toNumber(valuation.stock_cost_value)
  const retail = toNumber(valuation.stock_retail_value)
  const maxVal = Math.max(cost, retail, 1)
  return (
    <div className="clay-card rep-val flex flex-col gap-3 p-5">
      <h3 className="font-heading text-base font-bold">المخزون بنظرة</h3>
      <div className="flex flex-col items-center gap-4">
        <div className="clay-chart relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                innerRadius={44}
                outerRadius={62}
                strokeWidth={0}
                paddingAngle={3}
                animationDuration={900}
              >
                <Cell fill="var(--primary)" />
                <Cell fill="color-mix(in oklab, var(--primary) 18%, white)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-heading text-xl font-bold leading-none">
              {formatNumber(inStock)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              متوفر من {formatNumber(valuation.total_medications)}
            </p>
          </div>
        </div>
        <div className="w-full space-y-3 text-sm">
          {(
            [
              ["قيمة المخزون (تكلفة)", cost],
              ["قيمة المخزون (بيع)", retail],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-mono text-xs font-semibold">
                  {formatMoney(value)}
                </span>
              </div>
              <div className="clay-well mt-1 h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max((value / maxVal) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">الربح المتوقع</span>
            <span className="font-mono text-sm font-bold text-primary">
              {formatMoney(valuation.potential_profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The locked /reports experience — teaser + locked download buttons. */
function LockedReportsPage() {
  function lockedToast() {
    toast("هذه الميزة متاحة بعد الترقية", {
      description: "تواصل معنا لتفعيل التقارير والتحليلات لمتجرك.",
      icon: <Lock className="size-4" />,
    })
  }
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="التقارير والتحليلات"
        description="تحليلات عميقة للمخزون والمبيعات"
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {["تنزيل الملخص", "تنزيل الأكثر مبيعاً", "تنزيل تقرير المخزون"].map(
          (label) => (
            <button
              key={label}
              type="button"
              onClick={lockedToast}
              className="clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium opacity-80"
            >
              <Lock className="size-4" />
              {label}
            </button>
          ),
        )}
        <span className="pill pill-neutral ms-auto inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          ميزة مدفوعة
        </span>
      </div>
      <LockedReportsTeaser title="قم بالترقية لفتح التقارير الكاملة" />
    </div>
  )
}

const NAME_MAX_CHARS = 50

/** Name cell: caps at 50 chars with «…»; hover/click reveals the full name in a
 *  tooltip that dismisses itself after 5s, or on blur / click-outside. */
function TruncatedName({ name }: { name: string }) {
  const full = name || "—"
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const open = () => {
    setShow(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 5000)
  }
  const close = () => {
    setShow(false)
    if (timer.current) clearTimeout(timer.current)
  }

  useEffect(() => {
    if (!show) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [show])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (full.length <= NAME_MAX_CHARS) return <span>{full}</span>
  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={open}
        className="cursor-help text-start"
      >
        {full.slice(0, NAME_MAX_CHARS)}…
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute bottom-full start-0 z-30 mb-1 max-w-xs whitespace-normal break-words rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-normal text-background shadow-lg"
        >
          {full}
        </span>
      )}
    </span>
  )
}

const DAY_LABEL = (d: number) =>
  `آخر ${d === 7 ? "٧ أيام" : d === 30 ? "٣٠ يوماً" : "٩٠ يوماً"}`

/** Compact period picker (7/30/90) — a dropdown that sits next to the filters. */
function PeriodDropdown({
  days,
  onChange,
}: {
  days: number
  onChange: (d: (typeof DAY_OPTIONS)[number]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="clay-chip inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium"
          >
            <CalendarRange className="size-3.5" />
            {DAY_LABEL(days)}
            <ChevronDown className="size-3.5 opacity-70" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-40 rounded-2xl p-1.5">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              onChange(d)
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition hover:bg-muted/60",
              days === d && "font-semibold text-primary",
            )}
          >
            {DAY_LABEL(d)}
            {days === d && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default function ReportsPage() {
  const scope = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // The table scrolls internally (not the page), so the infinite-scroll
  // observer must watch that container, not the viewport.
  const scrollRef = useRef<HTMLDivElement>(null)
  // The sub-filter cards strip — animated when the group changes.
  const groupCardsRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  // Click a row → edit that product in a modal (full record fetched on demand).
  const [editId, setEditId] = useState<number | null>(null)
  // Bulk edit every row behind the active filter.
  const [bulkOpen, setBulkOpen] = useState(false)
  const isOwner = useIsOwner()
  const { modules } = useModules()
  const invUnlocked = isOwner && hasModule(modules, "reports")
  const salesUnlocked = isOwner && hasModule(modules, "sales_reports")
  const scanUnlocked = isOwner && hasModule(modules, "scan_reports")

  const [tab, setTab] = useState<"inventory" | "sales" | "scans">("inventory")
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30)
  const [issue, setIssue] = useState<ReportIssueKey>("zero_price")
  const [group, setGroup] = useState<string>(() => groupOfIssue("zero_price"))
  const [search, setSearch] = useState("")
  const [ordering, setOrdering] = useState<string>("name")
  const [includeEqual, setIncludeEqual] = useState(false)
  const [lowStockN, setLowStockN] = useState(5)
  const [nameMin, setNameMin] = useState(3)
  const [nameMax, setNameMax] = useState(50)
  const [exporting, setExporting] = useState(false)
  const [advOpen, setAdvOpen] = useState(false)
  const [advAll, setAdvAll] = useState(false)
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [stockMin, setStockMin] = useState("")
  const [stockMax, setStockMax] = useState("")
  const [advCategory, setAdvCategory] = useState("")
  const [advManufacturer, setAdvManufacturer] = useState("")
  const dLowStockN = useDebounced(lowStockN, 400)
  const dNameMin = useDebounced(nameMin, 400)
  const dNameMax = useDebounced(nameMax, 400)
  const dPriceMin = useDebounced(priceMin, 400)
  const dPriceMax = useDebounced(priceMax, 400)
  const dStockMin = useDebounced(stockMin, 400)
  const dStockMax = useDebounced(stockMax, 400)
  const dCategory = useDebounced(advCategory, 400)
  const dManufacturer = useDebounced(advManufacturer, 400)
  const dSearch = useDebounced(search, 350)

  const effectiveIssue = advOpen && advAll ? ("all" as const) : issue

  const { data: summary, isLoading } = useQuery({
    queryKey: ["reports-summary", days],
    queryFn: () => reportsSummary(days),
    staleTime: 60_000,
    retry: 1,
    enabled: invUnlocked,
  })

  // Infinite scroll: rows accumulate as the user reaches the bottom.
  const {
    data: productPages,
    isLoading: productsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "reports-products",
      effectiveIssue,
      dSearch,
      ordering,
      includeEqual,
      dLowStockN,
      dNameMin,
      dNameMax,
      advOpen ? [dPriceMin, dPriceMax, dStockMin, dStockMax, dCategory, dManufacturer] : null,
    ],
    queryFn: ({ pageParam }) =>
      reportsProducts({
        issue: effectiveIssue,
        search: dSearch || undefined,
        page: pageParam,
        page_size: PAGE_SIZE,
        ordering,
        include_equal: includeEqual ? 1 : 0,
        low_stock_threshold: dLowStockN,
        name_min: dNameMin,
        name_max: dNameMax,
        ...(advOpen
          ? {
              price_min: dPriceMin || undefined,
              price_max: dPriceMax || undefined,
              stock_min: dStockMin || undefined,
              stock_max: dStockMax || undefined,
              category: dCategory || undefined,
              manufacturer: dManufacturer || undefined,
            }
          : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.page_size < last.count ? last.page + 1 : undefined,
    staleTime: 30_000,
    retry: 1,
    enabled: invUnlocked && tab === "inventory",
  })
  const rows = useMemo(
    () => (productPages?.pages ?? []).flatMap((p) => p.results ?? []),
    [productPages],
  )
  const totalCount = productPages?.pages?.[0]?.count ?? 0

  // Charts that track the ACTIVE filter (same queryset as the table). Falls
  // back to the whole-catalogue summary until the first response lands.
  const { data: filteredCharts } = useQuery({
    queryKey: [
      "reports-filtered-charts",
      effectiveIssue,
      dSearch,
      includeEqual,
      dLowStockN,
      dNameMin,
      dNameMax,
      advOpen ? [dPriceMin, dPriceMax, dStockMin, dStockMax, dCategory, dManufacturer] : null,
    ],
    queryFn: () =>
      reportsFilteredCharts({
        issue: effectiveIssue,
        search: dSearch || undefined,
        include_equal: includeEqual ? 1 : 0,
        low_stock_threshold: dLowStockN,
        name_min: dNameMin,
        name_max: dNameMax,
        ...(advOpen
          ? {
              price_min: dPriceMin || undefined,
              price_max: dPriceMax || undefined,
              stock_min: dStockMin || undefined,
              stock_max: dStockMax || undefined,
              category: dCategory || undefined,
              manufacturer: dManufacturer || undefined,
            }
          : {}),
      }),
    staleTime: 30_000,
    retry: 1,
    enabled: invUnlocked && tab === "inventory",
  })
  const chartValuation = filteredCharts?.valuation ?? summary?.valuation
  const chartCategories = filteredCharts?.categories ?? summary?.categories ?? []

  // Full product record for the edit modal (the table row is only a summary).
  const { data: editMed } = useQuery({
    queryKey: ["reports-edit-med", editId],
    queryFn: async () =>
      (await productsRetrieve(editId!)).data as Product,
    enabled: editId != null,
  })
  function closeEdit() {
    setEditId(null)
    // An edit can move a row in/out of the active filter → refresh the views.
    qc.invalidateQueries({ queryKey: ["reports-summary"] })
    qc.invalidateQueries({ queryKey: ["reports-products"] })
    qc.invalidateQueries({ queryKey: ["reports-filtered-charts"] })
  }

  // Load more when the sentinel enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      // Watch the internally-scrolling table container (falls back to the
      // viewport if it isn't mounted yet).
      { root: scrollRef.current, rootMargin: "600px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length])

  const ready = Boolean(summary?.issues && summary?.valuation)

  // Stagger the sub-filter cards in when the active group changes (or when the
  // summary first loads and they appear).
  useEffect(() => {
    const el = groupCardsRef.current
    if (!el) return
    gsap.fromTo(
      Array.from(el.children),
      { opacity: 0, y: 10, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.35,
        stagger: 0.04,
        ease: "power2.out",
        overwrite: true,
      },
    )
  }, [group, ready])

  useGSAP(
    () => {
      if (!ready || tab !== "inventory") return
      const enter = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars) => {
        gsap.utils.toArray<HTMLElement>(sel).forEach((el, i) => {
          // Animate on mount — NOT via ScrollTrigger. These cards reflow the
          // page as charts/images load, so a scroll position measured at mount
          // is stale and the trigger can silently never fire on mobile, leaving
          // the card stuck at opacity 0 (the middle of the report "disappears").
          gsap.fromTo(el, from, {
            ...to,
            opacity: 1,
            delay: (Number(to.delay) || 0) + i * 0.05,
            overwrite: "auto",
            clearProps: "transform,opacity",
          })
        })
      }
      enter(
        ".rep-kpi",
        { y: 44, opacity: 0, scale: 0.72 },
        { y: 0, scale: 1, duration: 0.75, ease: "back.out(3.2)" },
      )
      // No scrollTrigger here: the charts mount above the table in the same
      // paint and shift it down, so a position measured at mount is stale and
      // the trigger can never fire — leaving the table stuck at opacity 0.
      gsap.fromTo(
        ".rep-table",
        { y: 56, opacity: 0, scale: 0.97 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.8,
          ease: "back.out(2)",
          overwrite: "auto",
          clearProps: "transform,opacity",
        },
      )
      enter(
        ".rep-cats",
        { y: 52, opacity: 0, scale: 0.94 },
        { y: 0, scale: 1, duration: 0.85, ease: "back.out(2.4)" },
      )
      enter(
        ".rep-val",
        { x: 64, opacity: 0, rotate: 1.5 },
        { x: 0, rotate: 0, duration: 0.85, ease: "back.out(2.6)" },
      )
    },
    { scope, dependencies: [ready, days, tab] },
  )

  // Sales tab entrances.
  useGSAP(
    () => {
      if (tab !== "sales") return
      gsap.utils
        .toArray<HTMLElement>(".rep-kpi, .rep-chart, .rep-val, .rep-rank-top, .rep-rank-bottom")
        .forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 40, opacity: 0, scale: 0.85 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.7,
              delay: i * 0.04,
              ease: "back.out(2.6)",
              overwrite: "auto",
              clearProps: "transform,opacity",
            },
          )
        })
    },
    { scope, dependencies: [tab, salesUnlocked] },
  )

  // Filter change → rows animate in with the fresh values (first page only).
  useGSAP(
    () => {
      if (!rows.length) return
      gsap.fromTo(
        ".rep-table tbody tr",
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.02,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform,opacity",
        },
      )
    },
    { scope, dependencies: [effectiveIssue, dSearch, ordering] },
  )

  if (!invUnlocked && !salesUnlocked) {
    return <LockedReportsPage />
  }

  function bounceCard(el: HTMLElement, index: number) {
    gsap
      .timeline()
      .to(el, {
        y: -16,
        rotate: index % 2 ? 3.5 : -3.5,
        scale: 1.04,
        duration: 0.18,
        ease: "power2.out",
      })
      .to(el, {
        y: 0,
        rotate: 0,
        scale: 1,
        duration: 0.65,
        ease: "bounce.out",
        clearProps: "transform",
      })
  }

  function toggleSort(key: SortKey) {
    setOrdering((prev) => (prev === key ? `-${key}` : key))
  }

  function SortHead({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = ordering === sortKey || ordering === `-${sortKey}`
    const desc = ordering === `-${sortKey}`
    return (
      <TableHead className="text-start">
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={cn(
            "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          {active ? (
            desc ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )
          ) : (
            <ArrowUpDown className="size-3 opacity-50" />
          )}
        </button>
      </TableHead>
    )
  }

  async function handleExport(
    report: string,
    extra: Record<string, string | number> = {},
  ) {
    setExporting(true)
    try {
      await downloadReport(
        {
          report,
          days,
          include_equal: includeEqual ? 1 : 0,
          low_stock_threshold: dLowStockN,
          ...extra,
        },
        `report-${report}.xlsx`,
      )
      toast.success("تم تنزيل التقرير")
    } catch {
      toast.error("تعذر تنزيل التقرير")
    } finally {
      setExporting(false)
    }
  }

  const advInputs: Array<[string, string, (v: string) => void, string]> = [
    ["السعر من", priceMin, setPriceMin, "number"],
    ["السعر إلى", priceMax, setPriceMax, "number"],
    ["المخزون من", stockMin, setStockMin, "number"],
    ["المخزون إلى", stockMax, setStockMax, "number"],
    ["التصنيف", advCategory, setAdvCategory, "text"],
    ["الشركة", advManufacturer, setAdvManufacturer, "text"],
  ]

  return (
    <div ref={scope} className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="التقارير والتحليلات"
        description="تحليلات عميقة للمخزون والمبيعات — للمالك فقط"
      />

      {/* Top row: the period picker sits with the download of the full report
          (both are report-wide controls). Sales/scans keep the period here too. */}
      <div className="mb-2 flex min-h-9 items-center justify-end gap-2">
        <PeriodDropdown days={days} onChange={setDays} />
        {tab === "inventory" && invUnlocked && (
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport("all_issues")}
            title="ملف Excel — كل فلتر في ورقة مستقلة بأصنافه"
            className="clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="size-4" />
            )}
            تنزيل كل الفلاتر
          </button>
        )}
      </div>

      {/* Wide iOS-style tab switcher, centered. */}
      <div className="mb-3 flex justify-center">
        <div className="no-scrollbar flex w-full max-w-2xl justify-center overflow-x-auto">
          <SegmentedControl
            className="sm:w-full"
            options={[
              {
                value: "inventory",
                label: (
                  <>
                    <ChartPie className="size-4" /> المخزون
                  </>
                ),
              },
              {
                value: "sales",
                label: (
                  <>
                    <ChartColumn className="size-4" /> المبيعات
                  </>
                ),
                adornment: !salesUnlocked ? (
                  <Lock className="size-3.5" />
                ) : undefined,
              },
              {
                value: "scans",
                label: (
                  <>
                    <ScanBarcode className="size-4" /> استعلامات الأسعار
                  </>
                ),
                adornment: !scanUnlocked ? (
                  <Lock className="size-3.5" />
                ) : undefined,
              },
            ]}
            value={tab}
            onChange={(v) => setTab(v)}
          />
        </div>
      </div>

      {tab === "scans" ? (
        <ScanTab days={days} unlocked={scanUnlocked} />
      ) : tab === "sales" ? (
        <SalesTab days={days} unlocked={salesUnlocked} />
      ) : !invUnlocked ? (
        <LockedReportsTeaser title="قم بالترقية لفتح تقارير المخزون" />
      ) : (
        <>
          {/* Server-side self-verification failed → say so, never show
              silently-wrong numbers. */}
          {summary?.checks && !summary.checks.passed && (
            <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning-foreground">
              ⚠️ بعض المؤشرات غير متسقة رياضياً (
              {summary.checks.details
                .filter((d) => !d.ok)
                .map((d) => d.label)
                .join("، ")}
              ) — أرسل لقطة شاشة للدعم وسنصحّحها.
            </div>
          )}
          {/* Grouped filters: a centered group selector, then that group's
              cards — collapses ~3 loose rows into two compact ones, and scales
              as more filters are added. */}
          {isLoading || !ready ? (
            <div className="mb-5 space-y-3">
              <Skeleton className="mx-auto h-9 w-[34rem] max-w-full rounded-full" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-[22px]" />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-5">
              {/* Group selector — a segmented control so it's unmistakably
                  tappable (not a row of stats). Sits right under the tabs. */}
              <div className="mb-3 flex justify-center">
                <div className="no-scrollbar flex w-full max-w-3xl justify-center overflow-x-auto">
                  <SegmentedControl
                    className="sm:w-full"
                    options={ISSUE_GROUPS.map((g) => ({
                      value: g.label,
                      label: g.label,
                    }))}
                    value={group}
                    onChange={setGroup}
                  />
                </div>
              </div>
              <div
                ref={groupCardsRef}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              >
                {(
                  ISSUE_GROUPS.find((g) => g.label === group) ?? ISSUE_GROUPS[0]
                ).keys.map((key, idx) => {
                  const Icon = ISSUE_ICONS[key]
                  const active = issue === key && !(advOpen && advAll)
                  const count = summary?.issues?.[key] ?? 0
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        bounceCard(e.currentTarget, idx)
                        setIssue(key)
                        setAdvAll(false)
                      }}
                      className={cn(
                        "clay-card rep-kpi p-3 text-start",
                        active && "clay-card-primary",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-heading text-lg font-bold tracking-tight">
                          {formatNumber(count)}
                        </p>
                        <Icon
                          className={cn(
                            "size-4",
                            count > 0 ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                        {ISSUE_LABELS[key]}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Charts in a column on the LEFT beside the table; the two charts
              track the active filter. The TABLE (not the page) scrolls. */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4 lg:order-2">
              {ready ? (
                <>
                  <CategoriesCard categories={chartCategories} />
                  <ValuationChart valuation={chartValuation!} />
                </>
              ) : (
                <>
                  <Skeleton className="h-72 rounded-[22px]" />
                  <Skeleton className="h-64 rounded-[22px]" />
                </>
              )}
            </div>

            {/* Drill-down table — internally scrollable, infinite scroll */}
            <div className="clay-card rep-table flex min-h-0 min-w-0 flex-col p-5 lg:order-1">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="ابحث بالاسم أو الباركود…"
                className="w-full sm:w-72"
              />

              {issue === "below_cost" && !(advOpen && advAll) && (
                <label className="clay-chip flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium">
                  <Switch
                    checked={includeEqual}
                    onCheckedChange={(v) => setIncludeEqual(Boolean(v))}
                  />
                  شمول السعر المساوي للتكلفة
                </label>
              )}
              {issue === "low_stock" && !(advOpen && advAll) && (
                <label className="clay-chip flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium">
                  المخزون ≤
                  <Input
                    type="number"
                    min={0}
                    value={lowStockN}
                    onChange={(e) =>
                      setLowStockN(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="h-7 w-16 rounded-lg text-center font-mono"
                  />
                </label>
              )}
              {issue === "name_length" && !(advOpen && advAll) && (
                <label className="clay-chip flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium">
                  طول الاسم من
                  <Input
                    type="number"
                    min={1}
                    value={nameMin}
                    onChange={(e) =>
                      setNameMin(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-7 w-14 rounded-lg text-center font-mono"
                  />
                  إلى
                  <Input
                    type="number"
                    min={1}
                    value={nameMax}
                    onChange={(e) =>
                      setNameMax(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-7 w-14 rounded-lg text-center font-mono"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => setAdvOpen((v) => !v)}
                className={cn(
                  "clay-chip inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium",
                  advOpen && "clay-card-primary text-primary",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                فلاتر متقدمة
              </button>

              <span className="pill pill-neutral">
                {formatNumber(totalCount)} صنف
              </span>

              {/* Fix every row behind the active filter in one action. */}
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkOpen(true)}
                  title="تعديل كل الأصناف المطابقة للفلتر الحالي"
                  className="clay-chip inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-primary"
                >
                  <Wand2 className="size-3.5" />
                  تعديل جماعي
                </button>
              )}

              <button
                type="button"
                disabled={exporting}
                onClick={() => handleExport("issues", { issue })}
                className="clay-btn ms-auto inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
              >
                <ArrowDownToLine className="size-4" />
                تنزيل
              </button>
            </div>

            {advOpen && (
              <div className="clay-well mb-4 flex flex-wrap items-center gap-3 p-3.5">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch
                    checked={advAll}
                    onCheckedChange={(v) => setAdvAll(Boolean(v))}
                  />
                  {advAll ? "على كل الأصناف" : `ضمن «${ISSUE_LABELS[issue]}»`}
                </label>
                {advInputs.map(([label, value, set, type]) => (
                  <label
                    key={label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    {label}
                    <Input
                      type={type}
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className={cn(
                        "h-7 rounded-lg bg-card text-center",
                        type === "number" ? "w-20 font-mono" : "w-28",
                      )}
                    />
                  </label>
                ))}
              </div>
            )}

            {productsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                لا توجد أصناف مطابقة — ممتاز! 🎉
              </p>
            ) : (
              <div
                ref={scrollRef}
                className="-mx-1 min-h-0 flex-1 overflow-auto px-1 max-h-[62vh] lg:max-h-[calc(100dvh-14rem)]"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead label="الاسم" sortKey="name" />
                      <TableHead className="text-start">الباركود</TableHead>
                      <TableHead className="text-start">التصنيف</TableHead>
                      <SortHead label="السعر" sortKey="price" />
                      <SortHead label="التكلفة" sortKey="cost" />
                      <SortHead label="المخزون" sortKey="stock" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => {
                      const note =
                        issue === "broken_barcode" && !(advOpen && advAll)
                          ? barcodeProblem(m.barcode)
                          : ""
                      return (
                        <TableRow
                          key={m.id}
                          onClick={() => setEditId(m.id)}
                          className="cursor-pointer"
                          title="اضغط للتعديل"
                        >
                          <TableCell className="font-medium">
                            <TruncatedName name={m.name} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {m.barcode || "—"}
                            {note && (
                              <p className="mt-0.5 font-sans text-[10px] text-destructive/80">
                                {note}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{m.category || "—"}</TableCell>
                          <TableCell className="font-mono">
                            {formatMoney(m.price)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatMoney(m.cost)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "font-mono",
                              toNumber(m.stock) < 0 && "font-bold text-destructive",
                            )}
                          >
                            {formatNumber(toNumber(m.stock))}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {/* Infinite-scroll sentinel */}
                <div
                  ref={sentinelRef}
                  className="flex items-center justify-center py-3 text-xs text-muted-foreground"
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : hasNextPage ? (
                    "مرّر للمزيد…"
                  ) : (
                    `عرض ${formatNumber(rows.length)} من ${formatNumber(totalCount)}`
                  )}
                </div>
              </div>
            )}
            </div>
          </div>

        </>
      )}

      {/* Bulk edit — targets EXACTLY the rows behind the active filter. */}
      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={totalCount}
        filterLabel={
          advOpen && advAll ? "كل الأصناف" : ISSUE_LABELS[issue]
        }
        target={{
          all_matching: true,
          issue: effectiveIssue,
          search: dSearch || undefined,
          include_equal: includeEqual ? 1 : 0,
          low_stock_threshold: dLowStockN,
          name_min: dNameMin,
          name_max: dNameMax,
          ...(advOpen
            ? {
                price_min: dPriceMin || undefined,
                price_max: dPriceMax || undefined,
                stock_min: dStockMin || undefined,
                stock_max: dStockMax || undefined,
                category_filter: dCategory || undefined,
                manufacturer_filter: dManufacturer || undefined,
              }
            : {}),
        }}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["reports-summary"] })
          qc.invalidateQueries({ queryKey: ["reports-products"] })
          qc.invalidateQueries({ queryKey: ["reports-filtered-charts"] })
        }}
      />

      {/* Click-to-edit: the flagged field is spotlighted for a quick fix. Keyed
          by row id so it re-mounts (and re-focuses/bounces) on every open. */}
      <MedicationForm
        key={editId ?? "none"}
        open={editId != null && Boolean(editMed)}
        onOpenChange={(o) => {
          if (!o) closeEdit()
        }}
        product={editMed ?? null}
        highlight={ISSUE_HIGHLIGHT[issue]}
      />
    </div>
  )
}
