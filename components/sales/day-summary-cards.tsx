"use client"

import { useQuery } from "@tanstack/react-query"
import { Banknote, Cigarette, Loader2, Smartphone, Wallet } from "lucide-react"

import { salesDaySummary } from "@/api/sales"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * What the owner wants at a glance when he opens the sales page.
 *
 * Three numbers, above the table: phone credit, cigarettes, and the day's
 * total. He does not want to filter, sort or read a chart to get them — he
 * wants to walk past the screen and know.
 *
 * "Today" is the TRADING day, not the calendar one. The shop is still selling
 * at 1am and cashes up in the morning, so a sale rung at 00:30 belongs to the
 * day that is still running. The rollover hour is decided by the server and
 * applied in the shop's timezone; nothing here computes a date, because a till
 * with a wrong clock would then quietly disagree with the owner's books.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  topup: Smartphone,
  smoke: Cigarette,
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
  const { data, isLoading } = useQuery({
    queryKey: ["sales-day-summary"],
    queryFn: () => salesDaySummary().then((r) => r.data),
    // The owner leaves this page open on the office screen.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-4 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        جارٍ حساب مبيعات اليوم…
      </div>
    )
  }
  if (!data) return null

  const since = `منذ الساعة ${data.cutover_hour}:00 صباحاً`

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {data.groups.map((g) => (
        <Card
          key={g.key}
          label={g.label}
          amount={formatMoney(g.amount)}
          sub={`${formatNumber(g.count)} فاتورة · ${since}`}
          Icon={ICONS[g.key] ?? Wallet}
        />
      ))}
      <Card
        label="إجمالي مبيعات اليوم"
        amount={formatMoney(data.total.amount)}
        sub={`${formatNumber(data.total.count)} فاتورة · ${since}`}
        Icon={Banknote}
        accent
      />
    </div>
  )
}
