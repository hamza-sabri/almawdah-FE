"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { useDashboard } from "@/hooks/use-dashboard"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/dashboard/stat-cards"
import {
  GenderChart,
  MonthlyChart,
  PaidVsUnpaidChart,
  TopDebtorsChart,
} from "@/components/dashboard/charts"
import { ErrorState } from "@/components/states"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 p-4">
            <Skeleton className="mb-3 size-11 rounded-2xl" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}

export default function DebtStatsPage() {
  const { data: stats, isLoading, isError, refetch } = useDashboard()
  const scope = useRef<HTMLDivElement>(null)

  useStaggerCards(scope, ".chart-card", Boolean(stats))

  return (
    <div ref={scope} className="mx-auto w-full max-w-7xl">
      <Link
        href="/debts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        الديون
      </Link>
      <PageHeader
        title="إحصائيات الديون"
        description="نظرة تحليلية على الديون والزبائن"
      />

      {isLoading && <InsightsSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {stats && (
        <div className="flex flex-col gap-4 md:gap-5">
          <StatCards stats={stats} />
          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            <MonthlyChart stats={stats} />
            <TopDebtorsChart stats={stats} />
            <PaidVsUnpaidChart stats={stats} />
            <GenderChart stats={stats} />
          </div>
        </div>
      )}
    </div>
  )
}
