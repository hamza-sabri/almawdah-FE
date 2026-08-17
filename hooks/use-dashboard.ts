"use client"

import { useQuery } from "@tanstack/react-query"
import customFetch from "@/api/http"
import { toNumber } from "@/lib/format"

/**
 * Home / insights KPIs. One Redis-cached backend call
 * (`GET /debts/dashboard/`) instead of paging every debt + customer down to
 * the browser like the previous implementation did.
 */

type ApiDashboard = {
  total_outstanding: string | number
  total_collected: string | number
  unpaid_count: number
  paid_count: number
  customer_count: number
  gender_counts: { male: number; female: number }
  monthly: { month: string; count: number; amount: string | number }[]
  top_debtors: { id: number; name: string; amount: string | number }[]
}

export type DashboardStats = {
  totalOutstanding: number
  totalCollected: number
  customerCount: number
  unpaidCount: number
  paidCount: number
  genderCounts: { male: number; female: number; unknown: number }
  topDebtors: { name: string; amount: number }[]
  monthly: { month: string; count: number; amount: number }[]
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  return new Intl.DateTimeFormat("ar-u-nu-latn", {
    month: "short",
    year: "2-digit",
  }).format(new Date(Number(y), Number(m) - 1, 1))
}

function adapt(api: ApiDashboard): DashboardStats {
  return {
    totalOutstanding: toNumber(api.total_outstanding),
    totalCollected: toNumber(api.total_collected),
    customerCount: api.customer_count,
    unpaidCount: api.unpaid_count,
    paidCount: api.paid_count,
    genderCounts: { ...api.gender_counts, unknown: 0 },
    topDebtors: api.top_debtors.map((d) => ({
      name: d.name,
      amount: toNumber(d.amount),
    })),
    monthly: api.monthly.map((m) => ({
      month: monthLabel(m.month),
      count: m.count,
      amount: toNumber(m.amount),
    })),
  }
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await customFetch<{ data: ApiDashboard }>(
        "/api/v1/debts/dashboard/",
        { method: "GET" },
      )
      return adapt(res.data)
    },
    staleTime: 60_000,
  })
}
