"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronDown, History, Loader2, Printer } from "lucide-react"
import { useState } from "react"

import { salesRevisions, type SaleRevision } from "@/api/sales"
import { useMe, displayName } from "@/hooks/use-me"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { deliverAndToast } from "@/lib/print/deliver"
import { loadPrintSettings } from "@/lib/print/settings"
import type { ReceiptData } from "@/lib/print/receipt"

/**
 * Every earlier version of a corrected sale.
 *
 * A sale can be edited in place — same receipt number, same place in the day —
 * which is what the shop needs when the cashier rang the wrong item and the
 * customer is still at the counter. It is also how a till gets robbed: ring
 * ₪300, take the cash, edit the invoice down to ₪30. So nothing is overwritten
 * silently, and this is where the owner reads the chain back.
 *
 * Collapsed by default: on an ordinary invoice — which is nearly all of them —
 * there is nothing here to see, and the common case should not pay for the
 * rare one.
 */
export function SaleRevisions({
  saleId,
  count,
  receiptCode,
}: {
  saleId: number
  count: number
  /** The number printed as the barcode. Every version carries the SAME one. */
  receiptCode?: string
}) {
  const [open, setOpen] = useState(false)
  const { user } = useMe()
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const storeName = me?.pharmacy_name?.trim() || "المتجر"
  const logo = me?.pharmacy_logo || ""

  /**
   * Reprint one past version.
   *
   * The barcode is deliberately the SAME as the live invoice's: the receipt
   * code identifies the SALE, not the version, and scanning any piece of paper
   * from this sale must land on this sale. What stops the two being confused
   * is the «نسخة سابقة» marker printed above the numbers — without it there
   * would be two receipts, one number, different totals, and nothing on the
   * paper to say which is current.
   */
  function printVersion(rev: SaleRevision) {
    const snap = rev.snapshot
    const data: ReceiptData = {
      saleId,
      receiptCode: receiptCode || snap.receipt_code || undefined,
      versionLabel:
        rev.version === 1
          ? "نسخة سابقة — الأصلية"
          : `نسخة سابقة ${rev.version}`,
      items: snap.items.map((it) => ({
        name: it.variant_label
          ? `${it.medication_name} — ${it.variant_label}`
          : it.medication_name,
        quantity: Number(it.quantity),
        unitPrice: it.unit_price,
        lineTotal: it.line_total,
      })),
      total: toNumber(snap.total),
      discountedTotal: toNumber(snap.discounted_total),
      paymentMethod: snap.payment_method,
      isReturn: Boolean(snap.is_return),
      customerName: snap.customer_name || undefined,
      cashierName: rev.edited_by || displayName(user),
      // When the sale was RUNG, not when it was corrected — the version's own
      // header already says who changed it and when.
      createdAt: snap.created_at || undefined,
    }
    // Agent → browser → file, the same one door as every other print.
    void deliverAndToast(
      data,
      storeName,
      loadPrintSettings(),
      logo,
      `طباعة النسخة ${rev.version}`,
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ["sale-revisions", saleId],
    queryFn: () => salesRevisions(saleId).then((r) => r.data.results),
    // Only fetched once the owner actually asks.
    enabled: open,
    staleTime: 60_000,
  })

  if (!count) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-warning/40 bg-warning/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-warning-foreground transition hover:bg-warning/10"
      >
        <History className="size-4 shrink-0" />
        <span className="flex-1">
          هذه الفاتورة عُدّلت {count === 1 ? "مرة واحدة" : `${count} مرات`}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-warning/30 p-3">
          {isLoading && (
            <p className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              جارٍ تحميل النسخ السابقة…
            </p>
          )}
          {data?.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl border bg-card p-3 text-xs"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  النسخة {rev.version}
                  {rev.version === 1 ? " (الأصلية)" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {formatDate(rev.edited_at)}
                    {rev.edited_by ? ` — ${rev.edited_by}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => printVersion(rev)}
                    title={`طباعة النسخة ${rev.version} — بنفس باركود الفاتورة`}
                    aria-label={`طباعة النسخة ${rev.version}`}
                    className="grid size-7 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                  >
                    <Printer className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {rev.snapshot.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {it.variant_label
                        ? `${it.medication_name} — ${it.variant_label}`
                        : it.medication_name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {Number(it.quantity)} × {formatMoney(it.unit_price)}
                    </span>
                    <span className="w-16 shrink-0 text-end font-semibold tabular-nums">
                      {formatMoney(it.line_total)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                <span>الإجمالي وقتها</span>
                <span className="tabular-nums">
                  {formatMoney(rev.snapshot.discounted_total)}
                </span>
              </div>
            </div>
          ))}
          {data && data.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              لا توجد نسخ سابقة
            </p>
          )}
        </div>
      )}
    </div>
  )
}
