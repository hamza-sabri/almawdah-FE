"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  HandCoins,
  Package,
  Pencil,
  StickyNote,
  Trash2,
  UserCog,
} from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import type { Debt } from "@/api/generated/model"

/** The list API also returns `created_by_name`, not yet in the generated type. */
export type DebtRow = Debt & { created_by_name?: string }

function InfoChip({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  dir?: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  )
}

export function DebtDetailDialog({
  debt,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onMarkPaid,
  onMarkUnpaid,
  onPartialPay,
}: {
  debt: DebtRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onEdit?: (d: DebtRow) => void
  onDelete?: (d: DebtRow) => void
  onMarkPaid?: (d: DebtRow) => void
  onMarkUnpaid?: (d: DebtRow) => void
  onPartialPay?: (d: DebtRow) => void
}) {
  const items = debt?.items ?? []
  const [itemsOpen, setItemsOpen] = useState(false)
  const hasDiscount =
    debt != null &&
    debt.discounted_total != null &&
    toNumber(debt.discounted_total) !== toNumber(debt.total)

  // Items start collapsed on every newly-opened debt.
  useEffect(() => {
    if (open) setItemsOpen(false)
  }, [open, debt?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl"
      >
        {debt && (
          <>
            {/* ── Ink header ─────────────────────────────────────── */}
            <div
              className="ink-panel rounded-none p-6"
              style={{ borderRadius: 0, boxShadow: "none" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/customers/${debt.customer}`}
                    onClick={() => onOpenChange(false)}
                    className="bg-brand-gradient grid size-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white ring-2 ring-white/20 transition hover:brightness-110"
                    title="فتح ملف الزبون"
                  >
                    {debt.customer_name?.trim().charAt(0) || "؟"}
                  </Link>
                  <div className="min-w-0">
                    <DialogTitle className="truncate font-heading text-lg font-bold text-white">
                      <Link
                        href={`/customers/${debt.customer}`}
                        onClick={() => onOpenChange(false)}
                        className="hover:underline"
                      >
                        {debt.customer_name || "زبون"}
                      </Link>
                    </DialogTitle>
                    {debt.customer_phone && (
                      <p className="text-xs text-white/55" dir="ltr">
                        {debt.customer_phone}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "pill",
                    debt.is_paid
                      ? "bg-success/25 text-white"
                      : "bg-warning/25 text-white",
                  )}
                >
                  {debt.is_paid ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Clock className="size-3.5" />
                  )}
                  {debt.is_paid ? "مدفوع" : "غير مدفوع"}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                <div>
                  <p className="text-[11px] text-white/60">المبلغ المستحق</p>
                  <p className="font-heading text-2xl font-bold text-lime">
                    {formatMoney(debt.discounted_total ?? debt.total)}
                  </p>
                </div>
                {hasDiscount && (
                  <p className="text-sm text-white/45 line-through">
                    {formatMoney(debt.total)}
                  </p>
                )}
              </div>
            </div>

            {/* ── Body ───────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              {/* Quick collection — no edit mode needed. */}
              {(onMarkPaid || onPartialPay || onMarkUnpaid) && (
                <div className="grid grid-cols-2 gap-2">
                  {!debt.is_paid && onMarkPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        onMarkPaid(debt)
                      }}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-success/15 text-sm font-bold text-success-foreground transition hover:bg-success/25 active:scale-[0.98]"
                    >
                      <CheckCircle2 className="size-4.5" />
                      تحصيل كامل
                    </button>
                  )}
                  {!debt.is_paid && onPartialPay && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        onPartialPay(debt)
                      }}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary/10 text-sm font-bold text-primary transition hover:bg-primary/15 active:scale-[0.98]"
                    >
                      <HandCoins className="size-4.5" />
                      دفعة جزئية
                    </button>
                  )}
                  {debt.is_paid && onMarkUnpaid && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        onMarkUnpaid(debt)
                      }}
                      className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-2xl bg-warning/15 text-sm font-bold text-warning-foreground transition hover:bg-warning/25 active:scale-[0.98]"
                    >
                      <Clock className="size-4.5" />
                      إعادة لغير مدفوع
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <InfoChip
                  icon={<CalendarDays className="size-4" />}
                  label="التاريخ"
                  value={formatDate(debt.created_at)}
                />
                <InfoChip
                  icon={<UserCog className="size-4" />}
                  label="أنشئ بواسطة"
                  value={debt.created_by_name || "—"}
                />
              </div>
              {debt.note && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-warning/10 px-3.5 py-3">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <p className="text-sm leading-relaxed text-warning-foreground">
                    {debt.note}
                  </p>
                </div>
              )}

              {/* Collapsible items — closed by default. */}
              {items.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border">
                  <button
                    type="button"
                    onClick={() => setItemsOpen((s) => !s)}
                    aria-expanded={itemsOpen}
                    className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 transition hover:bg-muted"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Package className="size-4" />
                      </span>
                      الأصناف
                      <span className="pill pill-primary">{items.length}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-300",
                        itemsOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      itemsOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-start">الصنف</TableHead>
                            <TableHead className="text-center">الكمية</TableHead>
                            <TableHead className="text-end">السعر</TableHead>
                            <TableHead className="text-end">المجموع</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell className="max-w-[180px] truncate whitespace-normal font-medium">
                                {it.medication_name || "—"}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {it.quantity}
                              </TableCell>
                              <TableCell className="text-end tabular-nums">
                                {formatMoney(it.unit_price)}
                              </TableCell>
                              <TableCell className="text-end font-medium tabular-nums">
                                {formatMoney(it.line_total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-muted/50 p-3.5 text-sm text-muted-foreground">
                  مبلغ مباشر بدون أصناف مدرجة.
                </p>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            {(onEdit || onDelete) && (
              <div className="flex flex-row items-center gap-2 border-t border-border/70 bg-muted/30 px-6 py-4">
                {onEdit && (
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => {
                      onOpenChange(false)
                      onEdit(debt)
                    }}
                  >
                    <Pencil className="size-4" />
                    تعديل
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      onOpenChange(false)
                      onDelete(debt)
                    }}
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
