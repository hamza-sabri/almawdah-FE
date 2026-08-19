"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, PackagePlus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createVariant,
  deleteVariant,
  listVariants,
  updateVariant,
  type Variant,
} from "@/api/variants"
import { sanitizeQtyInput } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * "This product also comes in a box" — in one click.
 *
 * The full variants manager can express boxes, but it is built for colours and
 * sizes: attributes, value lists, generated combinations. For a shopkeeper who
 * only wants to say "a carton holds 24 and costs ₪20", that is a maze. This
 * asks the two questions that matter and writes the same ProductVariant the
 * POS already understands, so nothing downstream changes.
 *
 * A product has at most ONE box here on purpose. Anything more elaborate is
 * what the variants manager is still there for.
 */

/** The box among a product's variants: the one with a real pack size. */
export function findBox(variants: Variant[]): Variant | undefined {
  return variants.find((v) => Number(v.pack_size ?? 0) > 0)
}

export function BoxDialog({
  open,
  onOpenChange,
  productId,
  productName,
  piecePrice,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  productId: number | null
  productName: string
  /** Price of a single piece, used to suggest the box price. */
  piecePrice: string | number
}) {
  const qc = useQueryClient()
  const [pieces, setPieces] = useState("")
  const [price, setPrice] = useState("")
  const [barcode, setBarcode] = useState("")
  /** The owner typed a price, so stop auto-filling over it. */
  const [priceTouched, setPriceTouched] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => listVariants(productId!).then((r) => r.data.results),
    enabled: open && productId != null,
  })
  const box = data ? findBox(data) : undefined

  // Prefill from the existing box, once per open.
  useEffect(() => {
    if (!open) return
    if (box) {
      setPieces(String(Number(box.pack_size)))
      setPrice(box.price)
      setBarcode(box.barcode || "")
      // Treat a stored price as one the owner already chose. Without this the
      // auto-suggest below overwrote it with piece × count the moment the
      // dialog opened — silently resetting a box he had deliberately priced
      // cheaper, which is the whole point of selling boxes.
      setPriceTouched(true)
    } else {
      setPieces("")
      setPrice("")
      setBarcode("")
      setPriceTouched(false)
    }
  }, [open, box])

  const n = parseFloat(pieces)
  const unit = Number(piecePrice) || 0
  const suggested = Number.isFinite(n) && n > 0 ? unit * n : 0

  // Auto-fill the price from the piece price until the owner overrides it.
  useEffect(() => {
    if (!priceTouched && suggested > 0) setPrice(suggested.toFixed(2))
  }, [suggested, priceTouched])

  const priceNum = parseFloat(price)
  // More than one piece, or it is not a box.
  const valid =
    Number.isFinite(n) && n > 1 && Number.isFinite(priceNum) && priceNum > 0

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        product: productId!,
        // The label is what the cashier picks in the POS's النوع column.
        label: `عبوة ×${Number(n)}`,
        pack_size: String(n),
        price: priceNum.toFixed(2),
        barcode: barcode.trim(),
      }
      return box ? updateVariant(box.id, body) : createVariant(body)
    },
    onSuccess: () => {
      toast.success(box ? "تم تعديل العبوة" : "تمت إضافة العبوة")
      void qc.invalidateQueries({ queryKey: ["variants", productId] })
      void qc.invalidateQueries({ queryKey: ["products"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error((e as Error)?.message || "تعذّر الحفظ"),
  })

  const remove = useMutation({
    mutationFn: () => deleteVariant(box!.id),
    onSuccess: () => {
      toast.success("تم حذف العبوة")
      void qc.invalidateQueries({ queryKey: ["variants", productId] })
      void qc.invalidateQueries({ queryKey: ["products"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error((e as Error)?.message || "تعذّر الحذف"),
  })

  const busy = save.isPending || remove.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-5 text-primary" />
            {box ? "تعديل العبوة" : "إضافة عبوة"}
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-xs text-muted-foreground">
          {productName} — سعر القطعة {unit.toFixed(2)} ₪
        </p>

        {isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="box-pieces">عدد القطع داخل العبوة</Label>
              <Input
                id="box-pieces"
                value={pieces}
                onChange={(e) => setPieces(sanitizeQtyInput(e.target.value))}
                inputMode="numeric"
                dir="ltr"
                placeholder="24"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-price">سعر العبوة</Label>
              <Input
                id="box-price"
                value={price}
                onChange={(e) => {
                  setPriceTouched(true)
                  setPrice(sanitizeQtyInput(e.target.value))
                }}
                inputMode="decimal"
                dir="ltr"
                placeholder="0.00"
              />
              {suggested > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {Math.abs(priceNum - suggested) < 0.005
                    ? `= ${unit.toFixed(2)} × ${Number(n)}`
                    : `سعر القطع منفردة ${suggested.toFixed(2)} ₪ — أنت تبيع العبوة بـ ${
                        Number.isFinite(priceNum) ? priceNum.toFixed(2) : "—"
                      } ₪`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-barcode">
                باركود العبوة{" "}
                <span className="text-muted-foreground">(اختياري)</span>
              </Label>
              <Input
                id="box-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                dir="ltr"
                placeholder="امسح باركود العبوة إن وُجد"
              />
            </div>

            <p className="rounded-xl bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              في نقطة البيع يُضاف الصنف <b>كقطعة دائماً</b>. لبيع عبوة، اضغط على
              خانة <b>النوع</b> في السطر واختر «عبوة».
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {box ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => remove.mutate()}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              حذف العبوة
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            disabled={!valid || busy}
            onClick={() => save.mutate()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
