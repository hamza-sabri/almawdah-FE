"use client"

import { useEffect, useState } from "react"
import { HandCoins, Loader2 } from "lucide-react"

import { FormModal } from "@/components/form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, toNumber } from "@/lib/format"
import type { DebtRow } from "@/components/debt-detail-dialog"

const QUICK = [10, 20, 50, 100]

/**
 * Take a partial payment on a debt: the amount is subtracted from what's
 * left; covering everything marks the debt paid.
 */
export function PartialPaymentDialog({
  debt,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: {
  debt: DebtRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (amount: number) => void
  loading?: boolean
}) {
  const [amount, setAmount] = useState("")
  const remaining = debt ? toNumber(debt.discounted_total ?? debt.total) : 0
  const value = toNumber(amount)
  const left = Math.max(remaining - value, 0)

  useEffect(() => {
    if (open) setAmount("")
  }, [open, debt?.id])

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="دفعة جزئية"
      icon={<HandCoins className="size-4.5" />}
      footer={
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={loading || value <= 0 || value > remaining}
            onClick={() => onConfirm(value)}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <HandCoins className="size-4" />
            )}
            تسجيل الدفعة
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">المتبقي حالياً</span>
        <span className="font-heading text-lg font-bold">
          {formatMoney(remaining)}
        </span>
      </div>

      <Input
        type="number"
        step="0.5"
        min="0"
        max={remaining}
        dir="ltr"
        autoFocus
        placeholder="0.00"
        className="h-12 text-start font-heading text-xl font-bold"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() =>
              setAmount(String(Math.min(toNumber(amount) + a, remaining).toFixed(2)))
            }
            className="rounded-full bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 active:scale-95"
          >
            +{a} ₪
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(remaining.toFixed(2))}
          className="rounded-full bg-lime px-3.5 py-2 text-xs font-bold text-lime-foreground transition hover:brightness-95 active:scale-95"
        >
          المبلغ كاملاً
        </button>
      </div>

      {value > 0 && value <= remaining && (
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
            left === 0 ? "bg-success/12" : "bg-warning/12"
          }`}
        >
          <span className="text-sm font-medium">
            {left === 0 ? "سيُسدد الدين بالكامل" : "المتبقي بعد الدفعة"}
          </span>
          <span className="font-heading text-lg font-bold">
            {formatMoney(left)}
          </span>
        </div>
      )}
      {value > remaining && (
        <p className="text-sm font-medium text-destructive">
          الدفعة أكبر من المبلغ المتبقي.
        </p>
      )}
    </FormModal>
  )
}
