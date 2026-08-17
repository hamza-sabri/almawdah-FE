"use client"

import { useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowUpLeft,
  Boxes,
  CheckCircle2,
  Coins,
  Layers,
  TriangleAlert,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { useMedStats } from "@/hooks/use-med-stats"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { formatNumber, toNumber } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { CountUp } from "@/components/count-up"
import { ErrorState } from "@/components/states"
import { NoDataArt } from "@/components/illustrations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Clean horizontal bar list — each row is a link into the filtered list. */
function CategoryBars({
  items,
}: {
  items: { category: string; count: number }[]
}) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <Link
          key={it.category}
          href={`/products?category=${encodeURIComponent(it.category)}`}
          className="group flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-primary/5"
          title={`عرض منتجات «${it.category}»`}
        >
          <span className="w-24 shrink-0 truncate text-start text-sm text-muted-foreground transition-colors group-hover:text-primary md:w-32">
            {it.category}
          </span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-muted">
            <div
              className="absolute inset-y-0 start-0 rounded-lg transition-all group-hover:brightness-110"
              style={{
                width: `${Math.max((it.count / max) * 100, 4)}%`,
                backgroundImage:
                  "linear-gradient(90deg, var(--chart-1), var(--chart-3))",
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-end text-sm font-semibold tabular-nums">
            {formatNumber(it.count)}
          </span>
          <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  )
}

type Stat = {
  key: string
  label: string
  value: number
  icon: LucideIcon
  money?: boolean
  gradient: string
  /** Clicking the card opens the products list pre-filtered. */
  href?: string
  hint?: string
}

export default function MedStatsPage() {
  const { data, isLoading, isError, refetch } = useMedStats()
  const router = useRouter()
  const scope = useRef<HTMLDivElement>(null)

  useStaggerCards(scope, ".stat-card, .chart-card", Boolean(data))

  const stats: Stat[] = data
    ? [
        {
          key: "items",
          label: "الأصناف الفريدة",
          value: data.total_items,
          icon: Boxes,
          gradient: "linear-gradient(135deg, var(--chart-1), var(--chart-2))",
          href: "/inventory",
          hint: "عرض الكل",
        },
        {
          key: "in_stock",
          label: "متوفر",
          value: data.in_stock,
          icon: CheckCircle2,
          gradient: "linear-gradient(135deg, var(--chart-4), oklch(0.62 0.12 180))",
          href: "/inventory?stock_state=in",
          hint: "عرض المتوفر",
        },
        {
          key: "low",
          label: "مخزون منخفض",
          value: data.low_stock ?? 0,
          icon: TriangleAlert,
          gradient: "linear-gradient(135deg, var(--chart-5), oklch(0.65 0.18 45))",
          href: "/inventory?stock_state=low",
          hint: "عرض المنخفض",
        },
        {
          key: "out",
          label: "نافد من المخزون",
          value: data.out_of_stock,
          icon: XCircle,
          gradient: "linear-gradient(135deg, var(--destructive), var(--chart-2))",
          href: "/inventory?stock_state=out",
          hint: "عرض النافد",
        },
        {
          key: "units",
          label: "إجمالي الوحدات",
          value: data.total_units,
          icon: Layers,
          gradient: "linear-gradient(135deg, var(--chart-3), var(--chart-4))",
        },
        {
          key: "retail",
          label: "قيمة المخزون (بيع)",
          value: toNumber(data.retail_value),
          icon: Wallet,
          money: true,
          gradient: "linear-gradient(135deg, var(--chart-1), var(--chart-3))",
        },
        {
          key: "cost",
          label: "قيمة المخزون (تكلفة)",
          value: toNumber(data.cost_value),
          icon: Coins,
          money: true,
          gradient: "linear-gradient(135deg, var(--chart-2), var(--chart-1))",
        },
      ]
    : []

  return (
    <div ref={scope} className="mx-auto w-full max-w-7xl">
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        المنتجات
      </Link>

      <PageHeader
        title="إحصائيات المنتجات"
        description="اضغط أي بطاقة لاستعراض أدويتها في القائمة"
      />

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
            {stats.map((s) => {
              const Icon = s.icon
              const clickable = Boolean(s.href)
              return (
                <Card
                  key={s.key}
                  onClick={clickable ? () => router.push(s.href!) : undefined}
                  role={clickable ? "link" : undefined}
                  className={`stat-card relative gap-0 overflow-hidden p-4 ${
                    clickable ? "card-interactive cursor-pointer" : ""
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -end-8 -top-8 size-24 rounded-full opacity-15"
                    style={{ backgroundImage: s.gradient }}
                  />
                  <div className="mb-3 flex items-start justify-between">
                    <span
                      className="icon-chip size-11"
                      style={{ backgroundImage: s.gradient }}
                    >
                      <Icon className="size-5" />
                    </span>
                    {clickable && (
                      <span className="pill pill-primary inline-flex items-center gap-1">
                        {s.hint}
                        <ArrowUpLeft className="size-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-pretty">
                    {s.label}
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold tracking-tight md:text-2xl">
                    <CountUp
                      value={s.value}
                      decimals={s.money ? 2 : 0}
                      suffix={s.money ? " ₪" : ""}
                    />
                  </p>
                </Card>
              )
            })}
          </div>

          <Card className="chart-card">
            <CardHeader>
              <CardTitle className="text-base">
                أعلى التصنيفات — اضغط تصنيفاً لعرض أدويته
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.by_category.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <NoDataArt className="h-24 w-auto" />
                  <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
                </div>
              ) : (
                <CategoryBars items={data.by_category} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
