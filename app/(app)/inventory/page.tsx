"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowDownToLine,
  BarChart3,
  CalendarClock,
  CalendarX2,
  Check,
  CheckSquare,
  Layers,
  Loader2,
  PackagePlus,
  Package,
  PlusCircle,
  Tag,
  Trash2,
} from "lucide-react"

import { productsList } from "@/api/generated/products/products"
import {
  bulkDeleteMedications,
  downloadHesabateProducts,
  seedDemoMedications,
} from "@/api/products"
import type { Product } from "@/api/generated/model"
import { useInfiniteList } from "@/hooks/use-infinite-list"
import { useDebounced } from "@/hooks/use-debounced"
import { useGlobalScanner } from "@/hooks/use-global-scanner"
import { ENDPOINTS, remove } from "@/lib/mutate"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useIsOwner } from "@/lib/modules"

import { useMedStats } from "@/hooks/use-med-stats"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { PageHeader } from "@/components/page-header"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { SearchInput } from "@/components/search-input"
import { FilterMenu } from "@/components/filter-menu"
import { SortMenu } from "@/components/sort-menu"
import { LoadMore } from "@/components/load-more"
import { Fab } from "@/components/fab"
import { RowActions } from "@/components/row-actions"
import { EmptyState, ErrorState } from "@/components/states"
import { NoMedsArt } from "@/components/illustrations"
import { MedicationForm } from "@/components/forms/product-form"
import { VariantsManager } from "@/components/variants-manager"
import { PrintLabelDialog } from "@/components/print/print-label-dialog"
import { ConfirmDelete } from "@/components/confirm-delete"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Every barcode that resolves this product: primary + the extras. */
function productCodes(m: Product): string[] {
  const alts = (m as { alt_barcodes?: unknown }).alt_barcodes
  return [
    m.barcode,
    ...(Array.isArray(alts) ? alts.map(String) : []),
  ].filter((c): c is string => Boolean(c))
}

const SORT_OPTIONS = [
  { value: "name", label: "الاسم (أ–ي)" },
  { value: "-price", label: "الأعلى سعراً" },
  { value: "price", label: "الأقل سعراً" },
  { value: "-stock", label: "الأكثر مخزوناً" },
  { value: "expiry_date", label: "الأقرب انتهاءً" },
  { value: "-created_at", label: "الأحدث" },
]

const STOCK_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "in", label: "متوفر" },
  { value: "low", label: "مخزون منخفض" },
  { value: "out", label: "نافد" },
]

const EXPIRY_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "expired", label: "منتهي الصلاحية" },
  { value: "soon", label: "قريب الانتهاء" },
  { value: "none", label: "بدون تاريخ صلاحية" },
]

// How a product is sold. 404 of the shop's 2,398 products carry a box unit,
// and a box is priced differently from the pieces inside it — those are the
// rows to check before a stocktake or a price change. The card already showed
// a "١ أنواع" badge; this makes it searchable.
const UNITS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "pack", label: "له عبوة" },
  { value: "variant", label: "له أنواع" },
  { value: "plain", label: "قطعة فقط" },
]

function MedCard({
  med,
  onEdit,
  onDelete,
  onPrintLabel,
  onVariants,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  med: Product
  onEdit: () => void
  onDelete: () => void
  onPrintLabel: () => void
  onVariants: () => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  // DRF serialises DecimalField as a string, so this arrived as
  // `string | number` and every `stock <= 5` was relying on JS
  // coercion. Coerce once, here.
  const stock = Number(med.stock ?? 0)
  const variantCount =
    (med as unknown as { variants?: unknown[] }).variants?.length ?? 0
  const primaryAction = selectMode ? onToggleSelect : onEdit
  return (
    <Card
      onClick={primaryAction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          primaryAction?.()
        }
      }}
      className={cn(
        "med-card card-interactive cursor-pointer gap-0 p-2.5",
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="bg-brand-soft relative flex h-28 items-center justify-center overflow-hidden rounded-2xl">
        {med.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={med.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <Package className="size-9 text-primary/40" />
        )}
        {med.category && (
          <Badge
            variant="secondary"
            className="absolute start-2 top-2 rounded-full border-transparent bg-card/85 font-normal backdrop-blur-sm"
          >
            {med.category}
          </Badge>
        )}
        {variantCount > 0 && (
          <Badge className="absolute bottom-2 start-2 gap-1 rounded-full border-transparent bg-primary/90 backdrop-blur-sm">
            <Layers className="size-3" />
            {formatNumber(variantCount)} أنواع
          </Badge>
        )}
        {med.expiry_status === "expired" ? (
          <Badge className="absolute bottom-2 end-2 gap-1 rounded-full border-transparent bg-destructive/90 text-white backdrop-blur-sm">
            <CalendarX2 className="size-3" />
            منتهي
          </Badge>
        ) : med.expiry_status === "soon" ? (
          <Badge className="absolute bottom-2 end-2 gap-1 rounded-full border-transparent bg-warning/90 text-warning-foreground backdrop-blur-sm">
            <CalendarClock className="size-3" />
            {med.days_to_expiry != null
              ? `${formatNumber(med.days_to_expiry)} يوم`
              : "قريب"}
          </Badge>
        ) : null}
        {selectMode ? (
          <span
            className={cn(
              "absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full border-2 shadow-sm backdrop-blur-sm",
              selected
                ? "border-primary bg-primary text-white"
                : "border-muted-foreground/40 bg-card/85",
            )}
          >
            {selected && <Check className="size-4" />}
          </span>
        ) : (
          <div
            className="absolute end-1.5 top-1.5 rounded-full bg-card/80 shadow-sm backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <RowActions
              onEdit={onEdit}
              onDelete={onDelete}
              extra={[
                {
                  label: "الأنواع",
                  icon: <Layers className="size-4" />,
                  onClick: onVariants,
                },
                {
                  label: "طباعة ملصق",
                  icon: <Tag className="size-4" />,
                  onClick: onPrintLabel,
                },
              ]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        <p className="line-clamp-2 min-h-[2.6rem] text-sm font-medium leading-snug">
          {med.name}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-heading text-lg font-bold text-primary">
            {formatMoney(med.price)}
          </span>
          <span
            className={`pill ${
              stock <= 0
                ? "pill-danger"
                : stock <= 5
                  ? "pill-warning"
                  : "pill-neutral"
            }`}
          >
            مخزون {formatNumber(stock)}
          </span>
        </div>
        {med.expiry_date && (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-[11px] font-medium",
              med.expiry_status === "expired"
                ? "text-destructive"
                : med.expiry_status === "soon"
                  ? "text-warning-foreground"
                  : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3 shrink-0" />
            <span dir="ltr">ينتهي {med.expiry_date}</span>
          </p>
        )}
      </div>
    </Card>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="gap-0 p-0">
          <Skeleton className="h-28 rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-5 w-20" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function MedicationsPageInner() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scannedQ = searchParams.get("q") ?? ""
  const urlStockState = searchParams.get("stock_state") ?? "all"
  const urlCategory = searchParams.get("category") ?? ""
  const [searchRaw, setSearchRaw] = useState(scannedQ)
  const [stockState, setStockState] = useState(urlStockState)
  const [category, setCategory] = useState(urlCategory)
  const [expiry, setExpiry] = useState(searchParams.get("expiry") ?? "all")
  const [units, setUnits] = useState(searchParams.get("units") ?? "all")
  const scope = useRef<HTMLDivElement>(null)

  // Category choices come from the (Redis-cached) stats endpoint.
  const { data: medStats } = useMedStats()
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "الكل" },
      ...(medStats?.by_category ?? []).map((c) => ({
        value: c.category,
        label: c.category,
      })),
      // Keep a deep-linked category visible even if it's not in the top list.
      ...(urlCategory &&
      !(medStats?.by_category ?? []).some((c) => c.category === urlCategory)
        ? [{ value: urlCategory, label: urlCategory }]
        : []),
    ],
    [medStats, urlCategory],
  )

  // Show how many rows each choice holds, so the owner knows the size of the
  // job before he opens it. The backend may predate the field — then the
  // labels stay bare rather than reading "له عبوة (0)".
  const unitsOptions = useMemo(() => {
    const u = medStats?.units
    const n = (v?: number) => (typeof v === "number" ? ` (${formatNumber(v)})` : "")
    return [
      { value: "all", label: UNITS_OPTIONS[0].label },
      { value: "pack", label: `${UNITS_OPTIONS[1].label}${n(u?.pack)}` },
      { value: "variant", label: `${UNITS_OPTIONS[2].label}${n(u?.variant)}` },
      { value: "plain", label: `${UNITS_OPTIONS[3].label}${n(u?.plain)}` },
    ]
  }, [medStats])

  // A scan from anywhere lands here as ?q=<barcode>; the stats page links in
  // with ?stock_state= / ?category= to show a filtered breakdown.
  useEffect(() => {
    if (scannedQ) setSearchRaw(scannedQ)
  }, [scannedQ])
  useEffect(() => {
    setStockState(urlStockState)
  }, [urlStockState])
  useEffect(() => {
    setCategory(urlCategory)
  }, [urlCategory])
  const search = useDebounced(searchRaw, 300)
  // Hardware scanner works without clicking into the search box.
  useGlobalScanner(setSearchRaw)
  const [ordering, setOrdering] = useState("name")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [toLabel, setToLabel] = useState<Product | null>(null)
  const [toVariants, setToVariants] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const isOwner = useIsOwner()
  const [selectMode, setSelectMode] = useState(false)
  const [exportingHesabate, setExportingHesabate] = useState(false)
  async function handleExportHesabate() {
    setExportingHesabate(true)
    try {
      await downloadHesabateProducts()
      toast.success("تم تصدير المنتجات بصيغة حسابات")
    } catch {
      toast.error("تعذّر التصدير")
    } finally {
      setExportingHesabate(false)
    }
  }
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [flushOpen, setFlushOpen] = useState(false)
  const [flushAll, setFlushAll] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const params = useMemo(
    () => ({
      search: search || undefined,
      ordering,
      stock_state: stockState === "all" ? undefined : stockState,
      category: category || undefined,
      expiry: expiry === "all" ? undefined : expiry,
      units: units === "all" ? undefined : units,
      page_size: 24,
    }),
    [search, ordering, stockState, category, expiry, units],
  )

  const {
    items,
    count,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteList<Product>(["products"], productsList, params)

  // Bouncy staggered entrance whenever a new result set arrives.
  useStaggerCards(scope, ".med-card", !isLoading && items.length > 0, [
    search,
    ordering,
    stockState,
    category,
    units,
  ])

  const [presetBarcode, setPresetBarcode] = useState("")

  function openAdd() {
    setEditing(null)
    setPresetBarcode("")
    setFormOpen(true)
  }

  /** Scan-to-create: a scanned barcode with no match becomes a new product
   *  with the barcode already filled — the cashier types name + price only. */
  function openAddWithBarcode(code: string) {
    setEditing(null)
    setPresetBarcode(code)
    setFormOpen(true)
  }

  // The current search looks like a scanned barcode (digits, scanner range).
  const searchIsBarcode = /^\d{4,20}$/.test(search.trim())

  /**
   * Scan-to-open: the scan button sends `?open=<barcode>` from this page,
   * meaning "show me this product", not "search for this string".
   *
   *   exactly one match → open its edit sheet, as if the row had been tapped
   *   no match          → offer to create it, barcode pre-filled
   *   several matches   → leave the filtered list; picking is the user's call
   *
   * The param is consumed once (stripped from the URL) so a back-navigation
   * or a refetch doesn't pop the sheet open again underneath the cashier.
   */
  const openBarcode = searchParams.get("open") ?? ""
  const openHandled = useRef("")
  useEffect(() => {
    if (!openBarcode || isLoading || openHandled.current === openBarcode) return
    openHandled.current = openBarcode

    // ANY of the product's codes, not just the primary one. Matching only
    // `barcode` meant scanning a product's second sticker fell through to
    // "no match → create it", which silently offers to make a DUPLICATE of
    // an item the shop already has.
    const hits = items.filter((m) => productCodes(m).includes(openBarcode))
    if (hits.length === 1) {
      setEditing(hits[0])
      setPresetBarcode("")
      setFormOpen(true)
    } else if (hits.length === 0) {
      openAddWithBarcode(openBarcode)
    }

    const next = new URLSearchParams(searchParams.toString())
    next.delete("open")
    router.replace(`/inventory${next.size ? `?${next}` : ""}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBarcode, isLoading, items])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(ENDPOINTS.products, toDelete.id)
      toast.success("تم حذف المنتج")
      qc.invalidateQueries({ queryKey: ["products"] })
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelect(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function exitSelect() {
    setSelectMode(false)
    setSelected(new Set())
  }
  const allLoadedSelected =
    items.length > 0 && items.every((m) => selected.has(m.id))
  function toggleSelectAllLoaded() {
    setSelected(allLoadedSelected ? new Set() : new Set(items.map((m) => m.id)))
  }
  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await seedDemoMedications()
      toast.success(
        `تم استيراد ${formatNumber(res.data.created)} صنف من «${res.data.source}»`,
      )
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["pos-catalog"] })
      qc.invalidateQueries({ queryKey: ["med-stats"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الاستيراد")
    } finally {
      setSeeding(false)
    }
  }
  async function runFlush() {
    setFlushing(true)
    try {
      const res = await bulkDeleteMedications(
        flushAll ? { all: true } : { ids: [...selected] },
      )
      toast.success(`تم حذف ${formatNumber(res.data.deleted)} صنف`)
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["pos-catalog"] })
      qc.invalidateQueries({ queryKey: ["med-stats"] })
      setFlushOpen(false)
      exitSelect()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setFlushing(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="المخزون"
        description={count ? `${formatNumber(count)} صنف` : "إدارة أصناف المخزون"}
        action={
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                className="gap-1.5"
              >
                <CheckSquare className="size-4" />
                {selectMode ? "إلغاء التحديد" : "تحديد"}
              </Button>
            )}
            <Link
              href="/inventory/stats"
              className={cn(buttonVariants({ variant: "outline" }), "hidden gap-1.5 sm:inline-flex")}
            >
              <BarChart3 className="size-4" />
              إحصائيات
            </Link>
            {isOwner && (
              <Button
                variant="outline"
                onClick={handleExportHesabate}
                disabled={exportingHesabate}
                title="تصدير كل المنتجات بصيغة حسابات (xlsx) لإعادة استيرادها هناك"
                className="hidden gap-1.5 sm:inline-flex"
              >
                <ArrowDownToLine className="size-4" />
                تصدير إلى حسابات
              </Button>
            )}
            <Button onClick={openAdd} data-tour="page-add" className="hidden md:inline-flex">
              <PlusCircle className="size-4" />
              إضافة منتج
            </Button>
          </div>
        }
      />

      <StickyToolbar>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="ابحث بالاسم أو امسح الباركود…"
            className="flex-1"
            scan
          />
          <FilterMenu
            groups={[
              {
                label: "المخزون",
                value: stockState,
                onChange: setStockState,
                options: STOCK_OPTIONS,
              },
              {
                label: "التصنيف",
                value: category,
                onChange: setCategory,
                defaultValue: "",
                options: categoryOptions,
              },
              {
                label: "الصلاحية",
                value: expiry,
                onChange: setExpiry,
                options: EXPIRY_OPTIONS,
              },
              {
                label: "الوحدات",
                value: units,
                onChange: setUnits,
                options: unitsOptions,
              },
            ]}
          />
          <SortMenu
            value={ordering}
            options={SORT_OPTIONS}
            onChange={setOrdering}
          />
        </div>
      </StickyToolbar>

      {selectMode && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2.5 shadow-sm">
          <button
            type="button"
            onClick={toggleSelectAllLoaded}
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-md border-2",
                allLoadedSelected
                  ? "border-primary bg-primary text-white"
                  : "border-muted-foreground/40",
              )}
            >
              {allLoadedSelected && <Check className="size-3.5" />}
            </span>
            تحديد المعروض
          </button>
          <span className="text-sm text-muted-foreground">
            {formatNumber(selected.size)} محدد
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => {
                setFlushAll(false)
                setFlushOpen(true)
              }}
            >
              <Trash2 className="size-4" />
              حذف المحدد
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setFlushAll(true)
                setFlushOpen(true)
              }}
            >
              <Trash2 className="size-4" />
              حذف كل المنتجات
            </Button>
          </div>
        </div>
      )}

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && searchIsBarcode && (
        <EmptyState
          art={<NoMedsArt className="h-36 w-auto" />}
          title="الباركود غير موجود"
          description={`لا يوجد صنف بالباركود ${search.trim()} — أنشئه الآن والباركود معبّأ جاهز، يكفي الاسم والسعر.`}
          action={
            <Button onClick={() => openAddWithBarcode(search.trim())} size="sm">
              <PlusCircle className="size-4" />
              إنشاء صنف بهذا الباركود
            </Button>
          }
        />
      )}
      {!isLoading && !isError && items.length === 0 && !searchIsBarcode && (
        <EmptyState
          art={<NoMedsArt className="h-36 w-auto" />}
          title="لا توجد منتجات"
          description="ابدأ بإضافة أول منتج، أو استورد بيانات تجريبية جاهزة"
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={openAdd} size="sm">
                <PlusCircle className="size-4" />
                إضافة منتج
              </Button>
              <Button
                onClick={handleSeed}
                size="sm"
                variant="outline"
                disabled={seeding}
              >
                {seeding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackagePlus className="size-4" />
                )}
                استيراد بيانات تجريبية
              </Button>
            </div>
          }
        />
      )}

      {items.length > 0 && (
        <>
          <div
            ref={scope}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {items.map((m) => (
              <MedCard
                key={m.id}
                med={m}
                onEdit={() => {
                  setEditing(m)
                  setFormOpen(true)
                }}
                onDelete={() => setToDelete(m)}
                onPrintLabel={() => setToLabel(m)}
                onVariants={() => setToVariants(m)}
                selectMode={selectMode}
                selected={selected.has(m.id)}
                onToggleSelect={() => toggleSelect(m.id)}
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

      {/* Also on desktop: on a long list the toolbar's "إضافة منتج" scrolls
          away, and this is the page the owner adds things from all day. */}
      <Fab onClick={openAdd} label="إضافة منتج" always />
      <MedicationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        initialBarcode={presetBarcode || undefined}
        onManageVariants={
          editing
            ? () => {
                const target = editing
                setFormOpen(false)
                setToVariants(target)
              }
            : undefined
        }
      />
      <VariantsManager
        open={Boolean(toVariants)}
        onOpenChange={(o) => !o && setToVariants(null)}
        medicationId={toVariants?.id ?? null}
        medicationName={toVariants?.name ?? ""}
        medicationPrice={toVariants?.price ?? ""}
      />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف المنتج"
        description={toDelete ? `سيتم حذف «${toDelete.name}».` : undefined}
      />
      <PrintLabelDialog
        open={Boolean(toLabel)}
        onOpenChange={(o) => !o && setToLabel(null)}
        med={
          toLabel
            ? {
                name: toLabel.name ?? "",
                price: toLabel.price,
                barcode: toLabel.barcode,
              }
            : null
        }
      />
      <Dialog
        open={flushOpen}
        onOpenChange={(o) => !o && !flushing && setFlushOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {flushAll
                ? "حذف كل المنتجات؟"
                : `حذف ${formatNumber(selected.size)} صنف؟`}
            </DialogTitle>
            <DialogDescription>
              {flushAll
                ? "سيتم حذف كل منتجات متجرك وأنواعها نهائياً لبدء استيراد جديد. سجلات المبيعات والديون تبقى محفوظة كما هي."
                : "سيتم حذف الأصناف المحددة وأنواعها نهائياً. سجلات المبيعات والديون تبقى محفوظة كما هي."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setFlushOpen(false)}
              disabled={flushing}
            >
              إلغاء
            </Button>
            <Button variant="destructive" onClick={runFlush} disabled={flushing}>
              {flushing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// useSearchParams() needs a Suspense boundary for the static prerender pass.
export default function MedicationsPage() {
  return (
    <Suspense fallback={null}>
      <MedicationsPageInner />
    </Suspense>
  )
}
