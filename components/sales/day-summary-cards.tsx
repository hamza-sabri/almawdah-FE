"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Banknote, Cigarette, Loader2, Smartphone, Wallet } from "lucide-react"

import { salesDaySummary } from "@/api/sales"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * What the owner opens the sales page for: جوال, دخان, and the takings.
 *
 * The window is the TRADING day, not the calendar one. The shop is still
 * selling at 1am and cashes up in the morning, so a sale rung at 00:30 belongs
 * to the day that is still running. Every preset here — day, week, month, or a
 * hand-picked range — starts and ends on that same rollover, which the SERVER
 * owns. Nothing on this page computes a date: a till with a wrong clock would
 * otherwise report a different period than the owner's books, silently.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  topup: Smartphone,
  smoke: Cigarette,
}

const PRESETS = [
  { key: "day", label: "اليوم" },
  { key: "week", label: "آخر ٧ أيام" },
  { key: "month", label: "هذا الشهر" },
] as const

/** What the figures below are counting, in words. */
function windowLabel(period: string, cutoverHour: number): string {
  switch (period) {
    case "week":
      return "آخر ٧ أيام"
    case "month":
      return "هذا الشهر"
    case "custom":
      return "الفترة المحددة"
    default:
      return `منذ الساعة ${cutoverHour}:00 صباحاً`
  }
}

function Card({
  label,
  sub,
  amount,
  Icon,
  accent,
}: {
  label: string
  sub: string
  amount: string
  Icon: React.ComponentType<{ className?: string }>
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        accent ? "border-primary/30 bg-primary/5" : "bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "font-heading text-xl font-bold tabular-nums",
            accent && "text-primary",
          )}
        >
          {amount}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

export function DaySummaryCards() {
  const [period, setPeriod] = useState<string>("day")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  // A range only counts once BOTH ends are set — a half-filled picker would
  // otherwise silently fall back to "today" while the inputs say otherwise.
  const ranged = Boolean(from && to)
  const params: Record<string, string> = ranged ? { from, to } : { period }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sales-day-summary", ranged ? `${from}:${to}` : period],
    queryFn: () => salesDaySummary(params).then((r) => r.data),
    // The owner leaves this page open on the office screen.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const chips = (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => {
            setPeriod(p.key)
            setFrom("")
            setTo("")
          }}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition",
            !ranged && period === p.key
              ? "border-primary bg-primary text-white"
              : "border-border bg-card text-muted-foreground hover:border-primary/50",
          )}
        >
          {p.label}
        </button>
      ))}
      <span className="mx-1 text-muted-foreground/50">|</span>
      {/* One field for both ends. Two separate date boxes let a cashier set an
          end before a start, or set one and wonder why nothing changed. */}
      <DateRangePicker
        value={{ from, to }}
        onChange={(r) => {
          setFrom(r.from)
          setTo(r.to)
        }}
        placeholder="فترة مخصصة"
      />
      {isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  )

  return (
    <div className="space-y-2.5">
      {chips}
      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-4 py-6 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          جارٍ حساب المبيعات…
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {data.groups.map((g) => {
            const since = windowLabel(data.period, data.cutover_hour)
            return (
              <Card
                key={g.key}
                label={g.label}
                amount={formatMoney(g.amount)}
                sub={`${formatNumber(g.count)} فاتورة · ${since}`}
                Icon={ICONS[g.key] ?? Wallet}
              />
            )
          })}
          <Card
            // Deliberately NOT "مبيعات اليوم": the same card now shows a week,
            // a month or a hand-picked range, and a label that says "اليوم"
            // over a month's takings is a number the owner would misread.
            label="إجمالي المبيعات"
            amount={formatMoney(data.total.amount)}
            sub={`${formatNumber(data.total.count)} فاتورة · ${windowLabel(data.period, data.cutover_hour)}`}
            Icon={Banknote}
            accent
          />
        </div>
      )}
    </div>
  )
}
