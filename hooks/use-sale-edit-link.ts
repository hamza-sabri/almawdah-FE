"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { salesGet, type Sale } from "@/api/sales"
import type { CartLine } from "@/hooks/use-pos-carts"

/**
 * `/pos?edit=<id>` — open a sale in the till so it can be corrected.
 *
 * The sales page links here rather than editing in a dialog, because a
 * correction is the same job as ringing a sale: scan, adjust a quantity, add
 * the item that was missed. Rebuilding all of that inside a modal would be a
 * second, worse POS.
 *
 * The `edit` parameter is stripped from the URL as soon as the cart exists, so
 * a refresh (or the back button) does not re-open a second correction on top
 * of the one already in progress.
 */

/** Turn a saved sale's lines back into cart lines the till can work with. */
export function saleToCartLines(sale: Sale): CartLine[] {
  return sale.items.map((it, i) => ({
    // Stable within the cart; the sale's own item ids are not reused because
    // the correction may add lines that have none yet.
    key: `edit${sale.id}_${it.id ?? i}`,
    medicationId: it.product ?? null,
    variantId: it.variant ?? null,
    name: it.medication_name || "صنف",
    variantLabel: it.variant_label || undefined,
    unitPrice: String(it.unit_price ?? "0"),
    // What the catalogue said at the time, so an override stays recognisable
    // as an override after the correction is saved.
    basePrice: String(it.original_unit_price ?? it.unit_price ?? "0"),
    quantity: Number(it.quantity ?? 1),
  }))
}

type Opener = (arg: {
  id: number
  receiptCode?: string
  customerId?: number | null
  customerName?: string
  payment?: "cash" | "debt"
  isReturn?: boolean
  discounted?: string
  lines: CartLine[]
}) => string

export function useSaleEditLink(openSaleForEdit: Opener) {
  const params = useSearchParams()
  const router = useRouter()
  const editId = params.get("edit")
  /**
   * The one and only guard: this sale has already been handled.
   *
   * A ref, because it has to survive React's development remount — the effect
   * runs, is cleaned up, and runs again, and without something that outlives
   * that the sale would be fetched twice and the toast raised twice.
   *
   * There is deliberately NO second `cancelled` flag inside the effect. The
   * two together cancel each other out: the first run fires the request and is
   * then cleaned up (cancelled = true), the second run short-circuits on this
   * ref and fires nothing — so the response from the first run arrives, sees
   * `cancelled`, and is thrown away. The request goes out, the server answers
   * 200, and the till shows an empty cart with no error anywhere. That is
   * exactly how this failed.
   */
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!editId || handled.current === editId) return
    handled.current = editId
    const id = Number(editId)
    if (!Number.isFinite(id) || id <= 0) return

    // The DETAIL route, not a filtered list: the sales filterset has no `id`
    // filter, so `?id=` would be ignored and the first page returned — the
    // cashier would open the newest sale for editing instead of the one she
    // tapped, and only notice after saving.
    void salesGet(id)
      .then((res) => {
        const sale = res.data
        if (!sale?.id) {
          toast.error("لم يتم العثور على الفاتورة")
          return
        }
        openSaleForEdit({
          id: sale.id,
          receiptCode: sale.receipt_code,
          customerId: sale.customer,
          customerName: sale.customer_name || "",
          payment: sale.payment_method,
          isReturn: Boolean(sale.is_return),
          // Only when it IS a discount — otherwise the field would look edited
          // the moment the cart opens and every later change would keep it.
          discounted:
            Number(sale.discounted_total) !== Number(sale.total)
              ? String(sale.discounted_total)
              : "",
          lines: saleToCartLines(sale),
        })
      })
      .catch(() => {
        toast.error("تعذّر فتح الفاتورة للتعديل")
      })
      .finally(() => {
        // Drop ?edit= once it has been acted on, so a refresh does not open a
        // second correction on top of the one already in progress.
        router.replace("/pos")
      })
  }, [editId, openSaleForEdit, router])
}
