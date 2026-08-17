"use client"

import Link from "next/link"
import { CalendarDays, CheckCircle2, Clock, Package, User as UserIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { RowActions } from "@/components/row-actions"
import { cn } from "@/lib/utils"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import type { Debt } from "@/api/generated/model"

export function DebtCard({
  debt,
  showCustomer = true,
  onEdit,
  onDelete,
}: {
  debt: Debt
  showCustomer?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const amount = debt.discounted_total ?? debt.total
  const hasDiscount =
    debt.discounted_total != null &&
    toNumber(debt.discounted_total) !== toNumber(debt.total)
  const itemCount = debt.items?.length ?? 0

  return (
    <Card className="card-interactive animate-in fade-in slide-in-from-bottom-2 relative gap-0 overflow-hidden p-0 duration-300">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 start-0 w-1.5",
          debt.is_paid ? "bg-accent" : "bg-destructive",
        )}
      />
      <div className="flex items-start gap-3 p-4 ps-5">
        <div className="min-w-0 flex-1">
          {showCustomer && (
            <Link
              href={`/customers/${debt.customer}`}
              className="flex items-center gap-1.5 font-semibold hover:underline"
            >
              <UserIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{debt.customer_name || "زبون"}</span>
            </Link>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="size-3.5" />
              {itemCount > 0
                ? `${itemCount} صنف`
                : debt.note?.trim() || "مبلغ مباشر"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDate(debt.created_at)}
            </span>
          </div>
          <span
            className={cn(
              "mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              debt.is_paid
                ? "bg-accent/15 text-accent"
                : "bg-destructive/10 text-destructive",
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
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="font-heading text-lg font-bold">
            {formatMoney(amount)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(debt.total)}
            </span>
          )}
          {(onEdit || onDelete) && (
            <RowActions onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>
      </div>
    </Card>
  )
}
