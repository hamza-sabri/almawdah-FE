"use client"

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  BadgeCheck,
  ReceiptText,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { CountUp } from "@/components/count-up"
import type { DashboardStats } from "@/hooks/use-dashboard"

type Stat = {
  key: string
  label: string
  value: number
  icon: LucideIcon
  money?: boolean
  gradient: string
  pill?: { text: string; className: string }
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  const scope = useRef<HTMLDivElement>(null)
  const debtCount = stats.paidCount + stats.unpaidCount

  const items: Stat[] = [
    {
      key: "outstanding",
      label: "الديون المستحقة",
      value: stats.totalOutstanding,
      icon: Wallet,
      money: true,
      gradient: "linear-gradient(135deg, var(--chart-1), var(--chart-2))",
      pill: { text: `${stats.unpaidCount} دين`, className: "pill-warning" },
    },
    {
      key: "collected",
      label: "إجمالي المحصّل",
      value: stats.totalCollected,
      icon: BadgeCheck,
      money: true,
      gradient: "linear-gradient(135deg, var(--chart-4), oklch(0.62 0.12 180))",
      pill: { text: `${stats.paidCount} دين`, className: "pill-success" },
    },
    {
      key: "customers",
      label: "الزبائن",
      value: stats.customerCount,
      icon: Users,
      gradient: "linear-gradient(135deg, var(--chart-3), var(--chart-1))",
    },
    {
      key: "debts",
      label: "إجمالي الديون",
      value: debtCount,
      icon: ReceiptText,
      gradient: "linear-gradient(135deg, var(--chart-2), var(--chart-5))",
      pill: {
        text: debtCount
          ? `${Math.round((stats.paidCount / debtCount) * 100)}٪ مدفوعة`
          : "—",
        className: "pill-primary",
      },
    },
  ]

  useGSAP(
    () => {
      gsap.fromTo(
        ".stat-card",
        { y: 24, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.07,
          ease: "back.out(2)",
          clearProps: "transform,opacity",
        },
      )
    },
    { scope },
  )

  return (
    <div ref={scope} className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card
            key={item.key}
            className="stat-card card-interactive relative gap-0 overflow-hidden p-4 md:p-5"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -end-10 -top-10 size-28 rounded-full opacity-12"
              style={{ backgroundImage: item.gradient }}
            />
            <div className="mb-3 flex items-start justify-between">
              <span
                className="icon-chip size-11"
                style={{ backgroundImage: item.gradient }}
              >
                <Icon className="size-5" />
              </span>
              {item.pill && (
                <span className={`pill ${item.pill.className}`}>
                  {item.pill.text}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground text-pretty">
              {item.label}
            </p>
            <p className="mt-1 font-heading text-xl font-bold tracking-tight md:text-2xl">
              <CountUp
                value={item.value}
                decimals={item.money ? 2 : 0}
                suffix={item.money ? " ₪" : ""}
              />
            </p>
          </Card>
        )
      })}
    </div>
  )
}
