"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ENDPOINTS, upsert } from "@/lib/mutate"
import { formatMoney, toNumber } from "@/lib/format"
import type { DebtRow } from "@/components/debt-detail-dialog"

/** Quick debt collection: full settle, partial payment, or re-open. */
export function useDebtPayment() {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["debts"] })
    qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    setPending(true)
    try {
      await fn()
      toast.success(success)
      invalidate()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
      return false
    } finally {
      setPending(false)
    }
  }

  const markPaid = (d: DebtRow) =>
    run(
      () => upsert(ENDPOINTS.debts, d.id, { is_paid: true }),
      "تم تحصيل الدين بالكامل",
    )

  const markUnpaid = (d: DebtRow) =>
    run(
      () => upsert(ENDPOINTS.debts, d.id, { is_paid: false }),
      "أُعيد الدين إلى غير مدفوع",
    )

  /** Subtract a payment from what's left; covering it all settles the debt. */
  const payPartial = (d: DebtRow, amount: number) => {
    const remaining = toNumber(d.discounted_total ?? d.total)
    const left = Math.max(remaining - amount, 0)
    const stamp = new Date().toISOString().slice(0, 10)
    const note = `${d.note ? `${d.note}\n` : ""}دفعة ${amount.toFixed(2)} ₪ (${stamp})`
    if (left <= 0) {
      return run(
        () => upsert(ENDPOINTS.debts, d.id, { is_paid: true, note }),
        "سُدد الدين بالكامل",
      )
    }
    return run(
      () =>
        upsert(ENDPOINTS.debts, d.id, {
          discounted_total: left.toFixed(2),
          note,
        }),
      `سُجلت الدفعة — المتبقي ${formatMoney(left)}`,
    )
  }

  return { markPaid, markUnpaid, payPartial, pending }
}
