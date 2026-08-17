"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { NoDataArt } from "@/components/illustrations"
import { formatMoney, formatNumber } from "@/lib/format"
import type { DashboardStats } from "@/hooks/use-dashboard"

function ChartCard({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <Card className="chart-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {badge && <span className="pill pill-neutral">{badge}</span>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <NoDataArt className="h-24 w-auto" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/** Donut with a headline number in its center and an always-visible legend
 *  (name + count + share) — no hovering required to read it. */
function Donut({
  data,
  config,
  centerLabel,
  centerValue,
}: {
  data: Array<{ key: string; label: string; value: number }>
  config: ChartConfig
  centerLabel: string
  centerValue: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-full">
        <ChartContainer
          config={config}
          className="clay-chart mx-auto aspect-square max-h-56"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              paddingAngle={3}
              cornerRadius={8}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={`var(--color-${d.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-heading text-2xl font-bold leading-none">
            {centerValue}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: `var(--color-${d.key})` }}
            />
            <span className="text-sm text-muted-foreground">{d.label}</span>
            <span className="text-sm font-bold tabular-nums">
              {formatNumber(d.value)}
            </span>
            <span className="pill pill-neutral px-2 py-0.5 text-[10px]">
              {total ? Math.round((d.value / total) * 100) : 0}٪
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaidVsUnpaidChart({ stats }: { stats: DashboardStats }) {
  const total = stats.paidCount + stats.unpaidCount
  const data = [
    { key: "paid", label: "مدفوعة", value: stats.paidCount },
    { key: "unpaid", label: "غير مدفوعة", value: stats.unpaidCount },
  ]
  const config: ChartConfig = {
    value: { label: "الديون" },
    paid: { label: "مدفوعة", color: "var(--chart-4)" },
    unpaid: { label: "غير مدفوعة", color: "var(--chart-5)" },
  }

  return (
    <ChartCard title="حالة الديون" badge={`${formatNumber(total)} دين`}>
      {total === 0 ? (
        <ChartEmpty text="لا توجد ديون بعد" />
      ) : (
        <Donut
          data={data}
          config={config}
          centerValue={
            total ? `${Math.round((stats.paidCount / total) * 100)}٪` : "0٪"
          }
          centerLabel="نسبة السداد"
        />
      )}
    </ChartCard>
  )
}

export function GenderChart({ stats }: { stats: DashboardStats }) {
  const data = [
    { key: "male", label: "ذكور", value: stats.genderCounts.male },
    { key: "female", label: "إناث", value: stats.genderCounts.female },
  ]
  const config: ChartConfig = {
    value: { label: "الزبائن" },
    male: { label: "ذكور", color: "var(--chart-1)" },
    female: { label: "إناث", color: "var(--chart-2)" },
  }
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard title="الزبائن حسب الجنس" badge={`${formatNumber(total)} زبون`}>
      {total === 0 ? (
        <ChartEmpty text="لا توجد بيانات جنس بعد" />
      ) : (
        <Donut
          data={data}
          config={config}
          centerValue={formatNumber(total)}
          centerLabel="إجمالي الزبائن"
        />
      )}
    </ChartCard>
  )
}

export function MonthlyChart({ stats }: { stats: DashboardStats }) {
  const config: ChartConfig = {
    amount: { label: "قيمة الديون", color: "var(--chart-1)" },
  }
  const empty = stats.monthly.length === 0

  return (
    <ChartCard title="قيمة الديون حسب الشهر" badge="آخر ٦ أشهر">
      {empty ? (
        <ChartEmpty text="لا توجد بيانات شهرية بعد" />
      ) : (
        <ChartContainer config={config} className="clay-chart h-64 w-full">
          <BarChart data={stats.monthly} margin={{ left: 8, right: 8 }}>
            <defs>
              <linearGradient id="rahmaBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-1)" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 6" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              reversed
            />
            <YAxis hide />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatMoney(Number(value))}
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="url(#rahmaBar)"
              radius={[10, 10, 4, 4]}
              maxBarSize={44}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}

/** Top debtors as an avatar + progress list (clearer than a bar chart). */
export function TopDebtorsChart({ stats }: { stats: DashboardStats }) {
  const empty = stats.topDebtors.length === 0
  const max = Math.max(...stats.topDebtors.map((d) => d.amount), 1)
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-1)",
  ]

  return (
    <ChartCard title="أعلى المدينين" badge="أول ٦">
      {empty ? (
        <ChartEmpty text="لا يوجد مدينون حالياً" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {stats.topDebtors.map((d, i) => (
            <li key={`${d.name}-${i}`} className="flex items-center gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: palette[i % palette.length] }}
              >
                {d.name.trim().charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="shrink-0 text-sm font-bold">
                    {formatMoney(d.amount)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max((d.amount / max) * 100, 4)}%`,
                      background: `linear-gradient(90deg, ${palette[i % palette.length]}, var(--chart-2))`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
