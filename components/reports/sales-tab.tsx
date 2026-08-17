"use client"

/**
 * تبويب المبيعات — deep sales analytics, its OWN paid module (sales_reports).
 * One cached call renders everything; locked accounts get the upsell teaser.
 */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownToLine, Loader2, RotateCcw, Users } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

import {
  downloadSalesReport,
  salesReportsSummary,
  type SalesReportsSummary,
  type TopProduct,
} from "@/api/reports"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { LockedReportsTeaser } from "@/components/reports/reports-teaser"
import { Skeleton } from "@/components/ui/skeleton"

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="clay-card rep-kpi p-4">
      <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

function RankList({
  title,
  rows,
  icon,
  className,
}: {
  title: string
  rows: Array<{ name: string; total?: string; revenue?: string; count?: number; sales?: number; quantity?: string }>
  icon?: React.ReactNode
  className?: string
}) {
  const values = rows.map((r) => Math.abs(toNumber(r.total ?? r.revenue ?? "0")))
  const max = Math.max(...values, 1)
  return (
    <div className={cn("clay-card p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-heading text-base font-bold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا بيانات في هذه الفترة.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => {
            const amount = r.total ?? r.revenue ?? "0"
            return (
              <li key={`${r.name}-${i}`}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.count != null && `${formatNumber(r.count)} عملية · `}
                    {r.quantity != null && `${formatNumber(toNumber(r.quantity))} قطعة · `}
                    {formatMoney(amount)}
                  </span>
                </div>
                <div className="clay-well mt-1 h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{
                      width: `${Math.max((Math.abs(toNumber(amount)) / max) * 100, 4)}%`,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function SalesTab({ days, unlocked }: { days: number; unlocked: boolean }) {
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["sales-reports-summary", days],
    queryFn: () => salesReportsSummary(days),
    staleTime: 60_000,
    retry: 1,
    enabled: unlocked,
  })

  const byDay = useMemo(
    () =>
      (data?.by_day ?? []).map((d) => ({
        day: d.day.slice(5),
        total: toNumber(d.total),
      })),
    [data],
  )
  const byHour = useMemo(
    () =>
      (data?.by_hour ?? []).map((h) => ({
        hour: `${h.hour}:00`,
        total: toNumber(h.total),
      })),
    [data],
  )

  if (!unlocked) {
    return (
      <LockedReportsTeaser title="تقارير المبيعات المتقدمة — ميزة منفصلة" />
    )
  }

  const ready = Boolean(data?.payment_split && data?.by_day)
  if (isLoading || !ready) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[26px]" />
        ))}
      </div>
    )
  }

  const cash = toNumber(data!.payment_split.cash)
  const debt = toNumber(data!.payment_split.debt)
  const split = [
    { name: "نقدي", value: Math.max(cash, 0) },
    { name: "دين", value: Math.max(debt, 0) },
  ]

  async function handleExport() {
    setExporting(true)
    try {
      await downloadSalesReport(days)
      toast.success("تم تنزيل تقرير المبيعات")
    } catch {
      toast.error("تعذر تنزيل التقرير")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* KPIs + export */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={exporting}
          onClick={handleExport}
          className="clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowDownToLine className="size-4" />
          )}
          تنزيل تقرير المبيعات
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="الإيراد" value={formatMoney(data!.revenue)} />
        <KpiCard label="عدد العمليات" value={formatNumber(data!.count)} />
        <KpiCard label="متوسط الفاتورة" value={formatMoney(data!.avg_basket)} />
        <KpiCard
          label="مرتجعات"
          value={formatNumber(data!.returns.count)}
          sub={formatMoney(data!.returns.value)}
        />
      </div>

      {/* Revenue by day + payment split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="clay-card rep-chart p-5 lg:col-span-2">
          <h3 className="font-heading mb-2 text-base font-bold">الإيراد اليومي</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay} margin={{ left: 4, right: 4 }}>
                <defs>
                  <linearGradient id="srev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v) => [formatMoney(Number(v)), "الإيراد"]} />
                <Area
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#srev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="clay-card rep-val p-5">
          <h3 className="font-heading mb-1 text-base font-bold">نقدي مقابل دين</h3>
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={split}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={70}
                  paddingAngle={3}
                  strokeWidth={0}
                  animationDuration={900}
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="color-mix(in oklab, var(--primary) 25%, white)" />
                </Pie>
                <Tooltip formatter={(v, n) => [formatMoney(Number(v)), String(n)]} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label sized to FIT inside the hole — no overlap. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <p className="w-full truncate font-mono text-[13px] font-bold leading-tight">
                {formatMoney(cash + debt)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">الإجمالي</p>
            </div>
          </div>
          <div className="mt-1 flex justify-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-full bg-primary" /> نقدي{" "}
              {formatMoney(cash)}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-full bg-primary/25" /> دين{" "}
              {formatMoney(debt)}
            </span>
          </div>
        </div>
      </div>

      {/* Hour-of-day pulse */}
      <div className="clay-card rep-chart p-5">
        <h3 className="font-heading mb-1 text-base font-bold">ساعات الذروة</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          الإيراد حسب ساعة اليوم — متى يزدحم محلّك؟
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour} margin={{ left: 4, right: 4 }}>
              <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v) => [formatMoney(Number(v)), "الإيراد"]} />
              <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankList
          title="الأكثر مبيعاً"
          rows={(data!.top_products ?? []) as TopProduct[]}
          className="rep-rank-top"
        />
        <RankList
          title="الأقل مبيعاً"
          rows={(data!.least_products ?? []) as TopProduct[]}
          className="rep-rank-bottom"
        />
        <RankList
          title="حسب الموظف"
          rows={data!.by_employee}
          icon={<Users className="size-4 text-primary" />}
          className="rep-rank-top"
        />
        <RankList
          title="أفضل الزبائن"
          rows={data!.top_customers}
          icon={<RotateCcw className="size-4 rotate-90 text-primary" />}
          className="rep-rank-bottom"
        />
      </div>
      <RankList
        title="المبيعات حسب التصنيف"
        // Map qty -> quantity so the row shows HOW MANY units were sold.
        rows={data!.by_category.map((c) => ({
          name: c.name,
          revenue: c.revenue,
          quantity: c.qty,
        }))}
        className="rep-chart"
      />
    </div>
  )
}
