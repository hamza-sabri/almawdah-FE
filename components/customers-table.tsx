"use client"

import { useRouter } from "next/navigation"
import { PlusCircle } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatMoney, toNumber } from "@/lib/format"
import type { Customer } from "@/api/generated/model"

/**
 * The daily-work customer table: who owes what, one tap to their profile,
 * one tap to open a new debt for them.
 */
export function CustomersTable({
  customers,
  onAddDebt,
}: {
  customers: Customer[]
  onAddDebt: (c: Customer) => void
}) {
  const router = useRouter()

  return (
    <div
      data-slot="card"
      className="overflow-hidden rounded-3xl border bg-card"
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-start">الزبون</TableHead>
            <TableHead className="hidden text-start sm:table-cell">
              الجنس
            </TableHead>
            <TableHead className="hidden text-start md:table-cell">
              الحالة
            </TableHead>
            <TableHead className="text-end">الرصيد المستحق</TableHead>
            <TableHead className="w-12 text-center">دين</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => {
            const outstanding = toNumber(c.outstanding)
            return (
              <TableRow
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="cursor-pointer transition-colors hover:bg-primary/4"
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={c.avatar || undefined} alt="" />
                      <AvatarFallback className="bg-brand-gradient text-sm font-bold text-white">
                        {c.name.trim().charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{c.name}</div>
                      {c.phone && (
                        <div
                          dir="ltr"
                          className="truncate text-start text-xs text-muted-foreground"
                        >
                          {c.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="pill pill-neutral">
                    {c.gender === "female" ? "أنثى" : "ذكر"}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {c.status || "—"}
                </TableCell>
                <TableCell className="text-end">
                  <span
                    className={`pill ${
                      outstanding > 0 ? "pill-warning" : "pill-success"
                    } font-heading text-sm`}
                  >
                    {formatMoney(c.outstanding)}
                  </span>
                </TableCell>
                <TableCell
                  className="text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onAddDebt(c)}
                    aria-label={`دين جديد لـ ${c.name}`}
                    title="دين جديد"
                    className="action-sq action-view"
                  >
                    <PlusCircle className="size-4.5" />
                  </button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
