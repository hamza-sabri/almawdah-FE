"use client"

/**
 * تبويب المسح — customer price-check scan analytics, its OWN paid module
 * (scan_reports). What shoppers scan on the /price kiosk: demand for what you
 * stock, and the barcodes that came up empty (things to price or order).
 *
 * One cached call; locked accounts get the upsell teaser. Filter / search /
 * sort + CSV are all client-side (snappy, no round-trips). GSAP bounce-in on
 * the cards; claymorphic surfaces throughout.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ArrowDownToLine, ArrowUpDown, Trash2 } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { clearScans, reportsScans } from "@/api/reports"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useDebounced } from "@/hooks/use-debounced"
import { cn } from "@/lib/utils"

import { ConfirmDelete } from "@/components/confirm-delete"
import { LockedReportsTeaser } from "@/components/reports/reports-teaser"
import { SearchInput } from "@/components/search-input"
import { Skeleton } from "@/components/ui/skeleton"

type SortKey = "name" | "count" | "days" | "price" | "stock"
type Sort = { key: SortKey; dir: "asc" | "desc" }
type Filter = "all" | "found" | "missing"

const MISS = "color-mix(in oklab, var(--chart-2) 60%, white)"

/** Slice colours for the top-scanned pie (clay palette). */
const PALETTE = [
  "var(--primary)",
  "color-mix(in oklab, var(--primary) 78%, white)",
  "color-mix(in oklab, var(--chart-2) 72%, white)",
  "color-mix(in oklab, var(--primary) 55%, white)",
  "color-mix(in oklab, var(--chart-2) 52%, white)",
  "color-mix(in oklab, var(--primary) 40%, white)",
  "color-mix(in oklab, var(--primary) 68%, black)",
  "color-mix(in oklab, var(--chart-2) 45%, black)",
  "color-mix(in oklab, var(--primary) 30%, white)",
  "color-mix(in oklab, var(--chart-2) 88%, white)",
]

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="clay-card rep-kpi scan-in p-4">
      <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

function SortHead({
  label,
  k,
  sort,
  setSort,
  align = "start",
  hideOnMobile = false,
}: {
  label: string
  k: SortKey
  sort: Sort
  setSort: (s: Sort) => void
  align?: "start" | "end"
  hideOnMobile?: boolean
}) {
  const active = sort.key === k
  return (
    <th
      onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
      className={cn(
        "cursor-pointer select-none py-2 text-xs font-medium",
        align === "end" ? "text-end" : "text-start",
        hideOnMobile && "hidden sm:table-cell",
      )}
    >
      <span className={cn("inline-flex items-center gap-1", align === "end" && "flex-row-reverse")}>
        {label}
        <ArrowUpDown className={cn("size-3", active ? "text-primary" : "opacity-40")} />
      </span>
    </th>
  )
}

export function ScanTab({ days, unlocked }: { days: number; unlocked: boolean }) {
  const scope = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState("")
  const dSearch = useDebounced(search, 200)
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<Sort>({ key: "count", dir: "desc" })
  const [piePin, setPiePin] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["reports-scans", days],
    queryFn: () => reportsScans(days),
    staleTime: 30_000,
    retry: 1,
    enabled: unlocked,
  })

  const qc = useQueryClient()
  const [clearOpen, setClearOpen] = useState(false)
  const clearMut = useMutation({
    mutationFn: clearScans,
    onSuccess: () => {
      setClearOpen(false)
      qc.invalidateQueries({ queryKey: ["reports-scans"] })
      toast.success("تم مسح بيانات التحليل")
    },
    onError: () => toast.error("تعذّر مسح البيانات"),
  })

  const byDay = useMemo(
    () =>
      (data?.by_day ?? []).map((d) => ({
        day: d.day.slice(5),
        matched: d.matched,
        not_found: d.not_found,
      })),
    [data],
  )

  const products = useMemo(() => data?.products ?? [], [data])

  const rows = useMemo(() => {
    const q = dSearch.trim().toLowerCase()
    let r = products
    if (filter === "found") r = r.filter((p) => p.found)
    else if (filter === "missing") r = r.filter((p) => !p.found)
    if (q) {
      r = r.filter(
        (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q),
      )
    }
    const dir = sort.dir === "asc" ? 1 : -1
    return [...r].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return dir * (a.name || a.barcode).localeCompare(b.name || b.barcode, "ar")
        case "days":
          return dir * (a.days - b.days)
        case "price":
          return dir * (toNumber(a.price ?? "0") - toNumber(b.price ?? "0"))
        case "stock":
          return dir * (toNumber(a.stock ?? "0") - toNumber(b.stock ?? "0"))
        default:
          return dir * (a.count - b.count)
      }
    })
  }, [products, dSearch, filter, sort])

  const pieData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((p) => ({ ...p, label: p.name || p.barcode })),
    [rows],
  )

  // Reset the pie selection whenever the filtered set changes.
  useEffect(() => {
    setPiePin(null)
  }, [dSearch, filter])

  useGSAP(
    () => {
      if (!data) return
      gsap.from(".scan-in", {
        y: 16,
        opacity: 0,
        scale: 0.94,
        duration: 0.5,
        ease: "back.out(1.7)",
        stagger: 0.05,
      })
    },
    { scope, dependencies: [data] },
  )

  function exportCsv() {
    const header = ["الباركود", "الاسم", "مرات المسح", "أيام", "موجود", "آخر مسح", "السعر", "المخزون"]
    const lines = rows.map((p) =>
      [
        p.barcode,
        p.name,
        String(p.count),
        String(p.days),
        p.found ? "نعم" : "لا",
        p.last_day ?? "",
        p.price ?? "",
        p.stock ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(","),
    )
    const csv = "﻿" + [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `scan-report-${days}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!unlocked) {
    return <LockedReportsTeaser title="تقارير مسح الأسعار — ميزة منفصلة" />
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[26px]" />
        ))}
      </div>
    )
  }

  const s = data.summary
  const ratePct = Math.round(toNumber(s.matched_rate) * 100)
  const donut = [
    { name: "موجود", value: Math.max(s.matched_scans, 0) },
    { name: "غير موجود", value: Math.max(s.not_found_scans, 0) },
  ]
  const empty = s.total_scans === 0

  return (
    <div ref={scope} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          ما يمسحه الزبائن على صفحة الأسعار — يُحدَّث يومياً.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          >
            <ArrowDownToLine className="size-4" /> تنزيل CSV
          </button>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" /> مسح البيانات
          </button>
        </div>
      </div>

      {empty ? (
        <div className="clay-card scan-in p-10 text-center text-muted-foreground">
          لا عمليات مسح في هذه الفترة بعد — ستظهر البيانات بعد أن يمسح الزبائن المنتجات.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="إجمالي المسح" value={formatNumber(s.total_scans)} />
            <KpiCard label="منتجات مختلفة" value={formatNumber(s.distinct_barcodes)} />
            <KpiCard
              label="نسبة التطابق"
              value={`${ratePct}%`}
              sub={`${formatNumber(s.matched_scans)} من ${formatNumber(s.total_scans)}`}
            />
            <KpiCard
              label="باركود بلا نتيجة"
              value={formatNumber(s.not_found_barcodes)}
              sub="طلب غير متوفر لديك"
            />
          </div>

          {/* Daily trend + match donut */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="clay-card rep-chart scan-in p-5 lg:col-span-2">
              <h3 className="font-heading mb-2 text-base font-bold">المسح اليومي</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={byDay} margin={{ left: 4, right: 4 }}>
                    <defs>
                      <linearGradient id="scmatch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="scmiss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                    <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                    <Tooltip
                      formatter={(v, n) => [
                        formatNumber(Number(v)),
                        n === "matched" ? "موجود" : "غير موجود",
                      ]}
                    />
                    <Area dataKey="matched" stackId="1" stroke="var(--primary)" strokeWidth={2.5} fill="url(#scmatch)" />
                    <Area dataKey="not_found" stackId="1" stroke="var(--chart-2)" strokeWidth={2} fill="url(#scmiss)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="clay-card rep-val scan-in p-5">
              <h3 className="font-heading mb-1 text-base font-bold">نتيجة المسح</h3>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                      animationDuration={900}
                    >
                      <Cell fill="var(--primary)" />
                      <Cell fill={MISS} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="font-heading text-lg font-bold leading-tight">{ratePct}%</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">تطابق</p>
                </div>
              </div>
              <div className="mt-1 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <i className="size-2.5 rounded-full bg-primary" /> موجود {formatNumber(s.matched_scans)}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="size-2.5 rounded-full" style={{ background: MISS }} /> غير موجود{" "}
                  {formatNumber(s.not_found_scans)}
                </span>
              </div>
            </div>
          </div>

          {/* Table (2/3) on the right, top-scanned donut (1/3) on the left. */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Table: no title; filters + search on the right (start in RTL). */}
            <div className="clay-card scan-in p-5 lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {(["all", "found", "missing"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={cn(
                        "clay-chip px-3 py-1.5 text-xs font-medium",
                        filter === f && "clay-card-primary text-primary",
                      )}
                    >
                      {f === "all" ? "الكل" : f === "found" ? "موجود" : "غير موجود"}
                    </button>
                  ))}
                </div>
                <div className="w-full sm:w-52">
                  <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم أو باركود…" />
                </div>
              </div>
              <div className="max-h-[360px] overflow-x-hidden overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <SortHead label="المنتج / الباركود" k="name" sort={sort} setSort={setSort} />
                    <SortHead label="مرات المسح" k="count" sort={sort} setSort={setSort} align="end" />
                    <SortHead label="أيام" k="days" sort={sort} setSort={setSort} align="end" hideOnMobile />
                    <SortHead label="السعر" k="price" sort={sort} setSort={setSort} align="end" hideOnMobile />
                    <SortHead label="المخزون" k="stock" sort={sort} setSort={setSort} align="end" hideOnMobile />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        لا بيانات مطابقة.
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => (
                      <tr key={p.barcode} className="border-t border-border/60">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: p.found ? "var(--primary)" : MISS }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.name || "—"}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">{p.barcode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-end font-semibold">{formatNumber(p.count)}</td>
                        <td className="hidden py-2 text-end text-muted-foreground sm:table-cell">
                          {formatNumber(p.days)}
                        </td>
                        <td className="hidden py-2 text-end sm:table-cell">
                          {p.price ? formatMoney(p.price) : "—"}
                        </td>
                        <td className="hidden py-2 text-end sm:table-cell">
                          {p.stock != null ? formatNumber(toNumber(p.stock)) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Top-scanned donut (1/3) — hover or tap a slice for its details. */}
            <div className="clay-card rep-val scan-in p-5">
              <h3 className="font-heading mb-1 text-base font-bold">الأكثر مسحاً</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                أعلى ١٠ منتجات مسحاً — تتبع فلاتر الجدول.
              </p>
              {pieData.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  لا بيانات مطابقة.
                </p>
              ) : (
                <>
                  <div className="relative mx-auto h-44 w-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={52}
                          outerRadius={70}
                          paddingAngle={2}
                          strokeWidth={0}
                          onClick={(_, i) => setPiePin((p) => (p === i ? null : i))}
                        >
                          {pieData.map((_, i) => {
                            const active = piePin
                            return (
                              <Cell
                                key={i}
                                fill={PALETTE[i % PALETTE.length]}
                                opacity={active === null || active === i ? 1 : 0.3}
                                className="cursor-pointer outline-none"
                              />
                            )
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {(() => {
                    const active = piePin
                    if (active == null || !pieData[active]) {
                      return (
                        <p className="mt-3 text-center text-[11px] text-muted-foreground">
                          اضغط على قسم لعرض تفاصيله.
                        </p>
                      )
                    }
                    const d = pieData[active]
                    return (
                      <div className="mt-3 rounded-2xl bg-muted/40 p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: PALETTE[active % PALETTE.length] }}
                          />
                          <span className="truncate text-sm font-semibold">
                            {d.name || "—"}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {d.barcode}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">مرات المسح</span>
                            <span className="font-semibold">{formatNumber(d.count)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">أيام</span>
                            <span>{formatNumber(d.days)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">السعر</span>
                            <span>{d.price ? formatMoney(d.price) : "—"}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">المخزون</span>
                            <span>
                              {d.stock != null ? formatNumber(toNumber(d.stock)) : "—"}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] font-medium">
                          {d.found ? (
                            <span className="text-primary">موجود</span>
                          ) : (
                            <span style={{ color: MISS }}>غير موجود</span>
                          )}
                        </p>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDelete
        open={clearOpen}
        onOpenChange={setClearOpen}
        onConfirm={() => clearMut.mutate()}
        loading={clearMut.isPending}
        title="مسح كل بيانات المسح؟"
        description="سيُحذف كل تحليل المسح لهذه الصيدلية نهائياً — لا يمكن التراجع."
        confirmLabel="مسح الكل"
      />
    </div>
  )
}
