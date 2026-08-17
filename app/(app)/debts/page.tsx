"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { BarChart3, PlusCircle, Users } from "lucide-react"

import { debtsList } from "@/api/generated/debts/debts"
import type { Debt } from "@/api/generated/model"
import { useDashboard } from "@/hooks/use-dashboard"
import { useDebtPayment } from "@/hooks/use-debt-payment"
import { usePagedList } from "@/hooks/use-paged-list"
import { useDebounced } from "@/hooks/use-debounced"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { ENDPOINTS, remove } from "@/lib/mutate"
import { formatMoney, formatNumber } from "@/lib/format"

import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { PaginationBar } from "@/components/pagination-bar"
import { Fab } from "@/components/fab"
import { DebtsTable } from "@/components/debts-table"
import { DebtDetailDialog, type DebtRow } from "@/components/debt-detail-dialog"
import { PartialPaymentDialog } from "@/components/partial-payment-dialog"
import { DebtForm } from "@/components/forms/debt-form"
import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState, ErrorState } from "@/components/states"
import { NoDebtsArt } from "@/components/illustrations"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PAGE_SIZE = 15

export default function DebtsPage() {
  const qc = useQueryClient()
  const [searchRaw, setSearchRaw] = useState("")
  const search = useDebounced(searchRaw, 300)
  const [status, setStatus] = useState("all") // all | unpaid | paid
  const [page, setPage] = useState(1)

  // Aggregated paid/unpaid totals — served from the Redis-cached dashboard
  // endpoint (invalidated automatically on any debt write).
  const { data: totals } = useDashboard()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [detail, setDetail] = useState<DebtRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [toDelete, setToDelete] = useState<DebtRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [partialFor, setPartialFor] = useState<DebtRow | null>(null)
  const payment = useDebtPayment()

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1)
  }, [search, status])

  const params = useMemo(
    () => ({
      search: search || undefined,
      is_paid: status === "all" ? undefined : status === "paid",
      ordering: "-created_at",
    }),
    [search, status],
  )

  const {
    results,
    count,
    pageCount,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = usePagedList<DebtRow>(["debts"], debtsList, params, page, PAGE_SIZE)

  const scope = useRef<HTMLDivElement>(null)
  useStaggerCards(scope, "tbody tr", !isLoading && results.length > 0, [
    search,
    status,
    page,
  ])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(ENDPOINTS.debts, toDelete.id)
      toast.success("تم حذف الدين")
      qc.invalidateQueries({ queryKey: ["debts"] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div ref={scope} className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="الديون"
        description={count ? `${formatNumber(count)} دين` : "إدارة ديون الزبائن"}
        action={
          <div className="flex items-center gap-2">
            {/* Customers moved off the mobile bottom bar → reachable here (mobile only). */}
            <Link
              href="/customers"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5 md:hidden")}
            >
              <Users className="size-4" />
              الزبائن
            </Link>
            <Link
              href="/debts/stats"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <BarChart3 className="size-4" />
              إحصائيات
            </Link>
            <Button onClick={openAdd} className="hidden md:inline-flex">
              <PlusCircle className="size-4" />
              دين جديد
            </Button>
          </div>
        }
      />

      <StickyToolbar>
        <SearchInput
          value={searchRaw}
          onChange={setSearchRaw}
          placeholder="ابحث باسم الزبون أو رقمه…"
        />
      </StickyToolbar>
      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">
            الكل
            {totals && (
              <span className="text-[10px] font-bold text-muted-foreground">
                ({formatMoney(totals.totalOutstanding + totals.totalCollected)})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unpaid">
            غير مدفوعة
            {totals && (
              <span className="text-[10px] font-bold text-warning-foreground">
                ({formatMoney(totals.totalOutstanding)})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid">
            مدفوعة
            {totals && (
              <span className="text-[10px] font-bold text-success-foreground">
                ({formatMoney(totals.totalCollected)})
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-xl" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && results.length === 0 && (
        <EmptyState
          art={<NoDebtsArt className="h-36 w-auto" />}
          title="لا توجد ديون"
          description="أضف أول دين لأحد الزبائن"
          action={
            <Button onClick={openAdd} size="sm">
              <PlusCircle className="size-4" />
              دين جديد
            </Button>
          }
        />
      )}
      {!isLoading && !isError && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <DebtsTable
            debts={results}
            onRowClick={(d) => {
              setDetail(d)
              setDetailOpen(true)
            }}
            onEdit={(d) => {
              setEditing(d)
              setFormOpen(true)
            }}
            onDelete={(d) => setToDelete(d)}
            onMarkPaid={(d) => payment.markPaid(d)}
            onMarkUnpaid={(d) => payment.markUnpaid(d)}
            onPartialPay={(d) => setPartialFor(d)}
          />
          <PaginationBar
            page={page}
            pageCount={pageCount}
            count={count}
            onPage={setPage}
            loading={isFetching}
          />
        </div>
      )}

      <Fab onClick={openAdd} label="دين جديد" />
      <DebtDetailDialog
        debt={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(d) => {
          setEditing(d)
          setFormOpen(true)
        }}
        onDelete={(d) => setToDelete(d)}
        onMarkPaid={(d) => payment.markPaid(d)}
        onMarkUnpaid={(d) => payment.markUnpaid(d)}
        onPartialPay={(d) => setPartialFor(d)}
      />
      <PartialPaymentDialog
        debt={partialFor}
        open={Boolean(partialFor)}
        onOpenChange={(o) => !o && setPartialFor(null)}
        loading={payment.pending}
        onConfirm={async (amount) => {
          if (partialFor) {
            const ok = await payment.payPartial(partialFor, amount)
            if (ok) setPartialFor(null)
          }
        }}
      />
      <DebtForm open={formOpen} onOpenChange={setFormOpen} debt={editing} />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف الدين"
        description="سيتم حذف هذا الدين نهائياً."
      />
    </div>
  )
}
