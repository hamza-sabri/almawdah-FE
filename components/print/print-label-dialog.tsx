"use client"

import { useMemo, useState } from "react"
import { Printer } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/format"
import { barcodeSvg, canEncodeBarcode } from "@/lib/print/barcode"
import { printLabels, type LabelItem } from "@/lib/print/receipt"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type LabelPaper = "58" | "80" | "a4"

export function PrintLabelDialog({
  open,
  onOpenChange,
  med,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  med: { name: string; price?: string | number; barcode?: string | null } | null
}) {
  const [copies, setCopies] = useState(1)
  const [paper, setPaper] = useState<LabelPaper>("80")
  const [showPrice, setShowPrice] = useState(true)

  const code = med?.barcode?.trim() || ""
  const hasBarcode = canEncodeBarcode(code)
  const previewSvg = useMemo(
    () => (hasBarcode ? barcodeSvg(code, { moduleWidth: 1.8, height: 46 }) : null),
    [code, hasBarcode],
  )

  function doPrint() {
    if (!med) return
    const item: LabelItem = { name: med.name, price: med.price, barcode: code || null }
    printLabels([item], {
      copies,
      paper,
      columns: paper === "a4" ? 3 : 1,
      showPrice,
    })
    onOpenChange(false)
  }

  const segBtn = (active: boolean) =>
    cn(
      "flex-1 rounded-lg py-2 text-sm font-semibold transition",
      active ? "bg-ink text-white shadow-sm" : "bg-muted text-muted-foreground",
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>طباعة ملصق باركود</DialogTitle>
          <DialogDescription className="truncate">{med?.name}</DialogDescription>
        </DialogHeader>

        {/* Live preview */}
        <div className="grid place-items-center rounded-2xl border bg-white p-4 text-center text-black">
          <div className="text-sm font-semibold">{med?.name}</div>
          {showPrice && med?.price != null && (
            <div className="font-heading text-lg font-extrabold">
              {formatMoney(med.price)}
            </div>
          )}
          {previewSvg ? (
            <div
              className="mt-1"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              لا يوجد باركود لهذا الصنف — سيُطبع الاسم والسعر فقط
            </div>
          )}
          {hasBarcode && <div className="text-[10px] tracking-widest">{code}</div>}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lbl-copies">عدد النسخ</Label>
              <Input
                id="lbl-copies"
                type="number"
                min={1}
                max={200}
                dir="ltr"
                className="text-start"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                }
              />
            </div>
            <label className="flex h-10 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3">
              <span className="text-sm font-medium">إظهار السعر</span>
              <Switch checked={showPrice} onCheckedChange={(v) => setShowPrice(Boolean(v))} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>مقاس الورق</Label>
            <div className="flex gap-2">
              {(
                [
                  { v: "58", l: "رول ٥٨" },
                  { v: "80", l: "رول ٨٠" },
                  { v: "a4", l: "ورقة A4" },
                ] as { v: LabelPaper; l: string }[]
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={segBtn(paper === o.v)}
                  onClick={() => setPaper(o.v)}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={doPrint}>
            <Printer className="size-4" />
            طباعة {copies > 1 ? `(${copies})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
