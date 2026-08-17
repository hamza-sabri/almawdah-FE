"use client"

import {
  CheckCircle2,
  Clock,
  HandCoins,
  Package,
  User as UserIcon,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RowActions } from "@/components/row-actions"
import { cn } from "@/lib/utils"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import type { DebtRow } from "@/components/debt-detail-dialog"

function StatusPill({ paid }: { paid?: boolean }) {
  return (
    <span className={cn("pill", paid ? "pill-success" : "pill-warning")}>
      {paid ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <Clock className="size-3.5" />
      )}
      {paid ? "مدفوع" : "غير مدفوع"}
    </span>
  )
}

export function DebtsTable({
  debts,
  showCustomer = true,
  onRowClick,
  onEdit,
  onDelete,
  onMarkPaid,
  onMarkUnpaid,
  onPartialPay,
}: {
  debts: DebtRow[]
  showCustomer?: boolean
  onRowClick: (d: DebtRow) => void
  onEdit?: (d: DebtRow) => void
  onDelete?: (d: DebtRow) => void
  onMarkPaid?: (d: DebtRow) => void
  onMarkUnpaid?: (d: DebtRow) => void
  onPartialPay?: (d: DebtRow) => void
}) {
  const showActions = Boolean(onEdit || onDelete || onMarkPaid)

  return (
    <div
      data-slot="card"
      className="overflow-hidden rounded-3xl border bg-card"
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {showCustomer && <TableHead className="text-start">الزبون</TableHead>}
            <TableHead className="hidden text-start sm:table-cell">
              التفاصيل
            </TableHead>
            <TableHead className="text-end">المبلغ</TableHead>
            <TableHead className="text-center">الحالة</TableHead>
            <TableHead className="hidden text-start sm:table-cell">
              التاريخ
            </TableHead>
            <TableHead className="hidden text-start md:table-cell">
              أنشئ بواسطة
            </TableHead>
            {showActions && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {debts.map((d) => {
            const amount = d.discounted_total ?? d.total
            const hasDiscount =
              d.discounted_total != null &&
              toNumber(d.discounted_total) !== toNumber(d.total)
            const itemCount = d.items?.length ?? 0
            return (
              <TableRow
                key={d.id}
                onClick={() => onRowClick(d)}
                className="cursor-pointer transition-colors hover:bg-primary/4"
              >
                {showCustomer && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                        {d.customer_name?.trim().charAt(0) || (
                          <UserIcon className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {d.customer_name || "زبون"}
                        </div>
                        {d.customer_phone && (
                          <div
                            className="truncate text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {d.customer_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                )}
                <TableCell className="hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Package className="size-3.5" />
                    {itemCount > 0 ? `${itemCount} صنف` : "مبلغ مباشر"}
                  </span>
                </TableCell>
                <TableCell className="text-end">
                  <div className="font-heading font-bold tabular-nums">
                    {formatMoney(amount)}
                  </div>
                  {hasDiscount && (
                    <div className="text-xs text-muted-foreground line-through tabular-nums">
                      {formatMoney(d.total)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusPill paid={d.is_paid} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatDate(d.created_at)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {d.created_by_name || "—"}
                </TableCell>
                {showActions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      extra={
                        d.is_paid
                          ? onMarkUnpaid
                            ? [
                                {
                                  label: "إعادة لغير مدفوع",
                                  icon: <Clock className="size-4" />,
                                  onClick: () => onMarkUnpaid(d),
                                },
                              ]
                            : []
                          : [
                              ...(onMarkPaid
                                ? [
                                    {
                                      label: "تحصيل كامل",
                                      icon: (
                                        <CheckCircle2 className="size-4 text-success" />
                                      ),
                                      onClick: () => onMarkPaid(d),
                                    },
                                  ]
                                : []),
                              ...(onPartialPay
                                ? [
                                    {
                                      label: "دفعة جزئية",
                                      icon: (
                                        <HandCoins className="size-4 text-primary" />
                                      ),
                                      onClick: () => onPartialPay(d),
                                    },
                                  ]
                                : []),
                            ]
                      }
                      onEdit={onEdit ? () => onEdit(d) : undefined}
                      onDelete={onDelete ? () => onDelete(d) : undefined}
                    />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
