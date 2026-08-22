"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowRight,
  CheckCircle2,
  HandCoins,
  Pencil,
  PlusCircle,
} from "lucide-react"

import { customersRetrieve } from "@/api/generated/customers/customers"
import { debtsList } from "@/api/generated/debts/debts"
import type { Customer, Debt } from "@/api/generated/model"
import { usePagedList } from "@/hooks/use-paged-list"
import { useDebtPayment } from "@/hooks/use-debt-payment"
import { ENDPOINTS, remove } from "@/lib/mutate"
import { hasModule, useModules } from "@/lib/modules"
import { formatMoney, toNumber } from "@/lib/format"
import { customerSettle } from "@/api/sales"

import { CustomerForm } from "@/components/forms/customer-form"
import { DebtForm } from "@/components/forms/debt-form"
import { DebtsTable } from "@/components/debts-table"
import { DebtDetailDialog, type DebtRow } from "@/components/debt-detail-dialog"
import { PartialPaymentDialog } from "@/components/partial-payment-dialog"
import { PaginationBar } from "@/components/pagination-bar"
import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState, ErrorState } from "@/components/states"
import { NoDebtsArt } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const PAGE_SIZE = 10

export default function CustomerDetailPage() {
  const routeParams = useParams<{ id: string }>()
  const id = Number(routeParams?.id)
  const qc = useQueryClient()
  // The debts ledger is a paid module. Without it /debts/ answers 403, and a
  // 403 rendered as "لا توجد ديون" is how the owner of سوبر ماركت المودة came
  // to read ₪0 of debt under a balance of ₪18,870. Say which it is.
  const { modules } = useModules()
  const canSeeDebts = hasModule(modules, "debts")

  const [editOpen, setEditOpen] = useState(false)
  const [debtFormOpen, setDebtFormOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [detail, setDetail] = useState<DebtRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [toDelete, setToDelete] = useState<DebtRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [partialFor, setPartialFor] = useState<DebtRow | null>(null)
  const payment = useDebtPayment()
  const [settleAllOpen, setSettleAllOpen] = useState(false)
  const [bulkPartialOpen, setBulkPartialOpen] = useState(false)
  const [settling, setSettling] = useState(false)

  async function settle(amount?: string) {
    setSettling(true)
    try {
      const res = await customerSettle(id, amount)
      toast.success(
        `حُصّل ${formatMoney(res.data.collected)} — المتبقي ${formatMoney(res.data.outstanding)}`,
      )
      qc.invalidateQueries({ queryKey: ["debts"] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setSettleAllOpen(false)
      setBulkPartialOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التحصيل")
    } finally {
      setSettling(false)
    }
  }

  const {
    data: customerRes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => customersRetrieve(String(id)),
    enabled: Number.isFinite(id),
  })
  const customer = customerRes?.data as Customer | undefined

  const {
    results: debts,
    count,
    pageCount,
    isLoading: debtsLoading,
    isFetching: debtsFetching,
    isError: debtsError,
    refetch: refetchDebts,
  } = usePagedList<DebtRow>(
    ["debts"],
    debtsList,
    { customer: id, ordering: "-created_at" },
    page,
    PAGE_SIZE,
    Number.isFinite(id) && canSeeDebts,
  )

  async function confirmDeleteDebt() {
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
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        الزبائن
      </Link>

      {isLoading && <Skeleton className="h-44 rounded-xl" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {customer && (
        <>
          <section className="ink-panel mb-5 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-full bg-brand-gradient p-[2.5px]">
                <Avatar className="size-16 ring-2 ring-white/20">
                  <AvatarImage src={customer.avatar || undefined} alt="" />
                  <AvatarFallback className="bg-ink text-lg font-bold text-lime">
                    {customer.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-xl font-bold text-white md:text-2xl">
                  {customer.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {customer.phone && (
                    <span className="pill bg-white/10 text-white/85" dir="ltr">
                      {customer.phone}
                    </span>
                  )}
                  {customer.gender && (
                    <span className="pill bg-white/10 text-white/85">
                      {customer.gender === "male" ? "ذكر" : "أنثى"}
                    </span>
                  )}
                  {customer.status && (
                    <span className="pill bg-white/10 text-white/85">
                      {customer.status}
                    </span>
                  )}
                </div>
                {customer.notes && (
                  <p className="mt-2.5 text-sm leading-relaxed text-white/60">
                    {customer.notes}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full border-0 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                تعديل
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <div>
                <span className="text-sm text-white/65">الرصيد المستحق</span>
                <p className="font-heading text-xl font-bold text-lime">
                  {formatMoney(customer.outstanding)}
                </p>
              </div>
              {toNumber(customer.outstanding) > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleAllOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-bold text-lime-foreground shadow-md shadow-lime/25 transition hover:brightness-95 active:scale-95"
                  >
                    <CheckCircle2 className="size-4" />
                    تحصيل الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkPartialOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15 active:scale-95"
                  >
                    <HandCoins className="size-4" />
                    دفعة من الحساب
                  </button>
                </div>
              )}
            </div>
          </section>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading font-bold">الديون</h2>
            {canSeeDebts && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingDebt(null)
                  setDebtFormOpen(true)
                }}
              >
                <PlusCircle className="size-4" />
                دين جديد
              </Button>
            )}
          </div>

          {!canSeeDebts && (
            <EmptyState
              art={<NoDebtsArt className="h-32 w-auto" />}
              title="سجل الديون غير مفعّل لهذا الحساب"
              description="الرصيد أعلاه صحيح، لكن عرض تفاصيل الديون يحتاج تفعيل وحدة «الديون» لهذا الحساب."
            />
          )}
          {canSeeDebts && debtsLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-xl" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          )}
          {/* A failed fetch must never read as "this customer owes nothing".
              The two states look identical to a cashier, and only one of them
              is safe to act on. */}
          {canSeeDebts && !debtsLoading && debtsError && (
            <ErrorState onRetry={() => refetchDebts()} />
          )}
          {canSeeDebts && !debtsLoading && !debtsError && debts.length === 0 && (
            <EmptyState
              art={<NoDebtsArt className="h-32 w-auto" />}
              title="لا توجد ديون"
              description="أضف أول دين لهذا الزبون"
            />
          )}
          {canSeeDebts && !debtsLoading && !debtsError && debts.length > 0 && (
            <div className="flex flex-col gap-3">
              <DebtsTable
                debts={debts}
                showCustomer={false}
                onRowClick={(d) => {
                  setDetail(d)
                  setDetailOpen(true)
                }}
                onEdit={(d) => {
                  setEditingDebt(d)
                  setDebtFormOpen(true)
                }}
                onDelete={(d) => setToDelete(d)}
                onMarkPaid={(d) => payment.markPaid(d)}
                onMarkUnpaid={(d) => payment.markUnpaid(d)}
                onPartialPay={(d) => setPartialFor(d)}
              />
              {pageCount > 1 && (
                <PaginationBar
                  page={page}
                  pageCount={pageCount}
                  count={count}
                  onPage={setPage}
                  loading={debtsFetching}
                />
              )}
            </div>
          )}
        </>
      )}

      <DebtDetailDialog
        debt={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(d) => {
          setEditingDebt(d)
          setDebtFormOpen(true)
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
      {/* Bulk collection: settle everything, or a payment applied oldest-first. */}
      <ConfirmDelete
        open={settleAllOpen}
        onOpenChange={setSettleAllOpen}
        onConfirm={() => settle()}
        loading={settling}
        title="تحصيل كل الديون"
        description={
          customer
            ? `سيتم تسديد كل ديون «${customer.name}» (${formatMoney(customer.outstanding)}).`
            : undefined
        }
        confirmLabel="تحصيل الكل"
        confirmIcon={<CheckCircle2 className="size-4" />}
      />
      <PartialPaymentDialog
        debt={
          customer && bulkPartialOpen
            ? ({
                id: 0,
                customer: customer.id,
                total: customer.outstanding,
                discounted_total: customer.outstanding,
              } as unknown as DebtRow)
            : null
        }
        open={bulkPartialOpen}
        onOpenChange={setBulkPartialOpen}
        loading={settling}
        onConfirm={(amount) => settle(amount.toFixed(2))}
      />
      <CustomerForm
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
      />
      <DebtForm
        open={debtFormOpen}
        onOpenChange={setDebtFormOpen}
        debt={editingDebt}
        lockedCustomer={
          customer ? { id: customer.id, name: customer.name } : undefined
        }
      />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDeleteDebt}
        loading={deleting}
        title="حذف الدين"
        description="سيتم حذف هذا الدين نهائياً."
      />
    </div>
  )
}
