"use client"

import { useState } from "react"
import { Loader2, Wand2 } from "lucide-react"
import { toast } from "sonner"

import {
  bulkUpdateMedications,
  undoAudit,
  type BulkChanges,
} from "@/api/products"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { formatNumber } from "@/lib/format"

/**
 * Fix imported data EN MASSE: apply one change to every product matching the
 * active report filter (or an explicit selection). The headline tool is
 * "price from cost + margin", which repairs thousands of zero-priced rows
 * imported from Hesabate in a single action.
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  count,
  filterLabel,
  /** Filter params identifying the rows (same shape the reports table sends). */
  target,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  count: number
  filterLabel: string
  target: Record<string, unknown>
  onDone?: (updated: number) => void
}) {
  const [saving, setSaving] = useState(false)
  const [useMargin, setUseMargin] = useState(true)
  const [margin, setMargin] = useState("25")
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [category, setCategory] = useState("")
  const [expiry, setExpiry] = useState("")

  function reset() {
    setUseMargin(true)
    setMargin("25")
    setPrice("")
    setCost("")
    setCategory("")
    setExpiry("")
  }

  async function apply() {
    const changes: BulkChanges = {}
    if (useMargin) {
      const m = Number(margin)
      if (!Number.isFinite(m) || m < 0) {
        toast.error("أدخل نسبة ربح صحيحة")
        return
      }
      changes.price_from_cost_margin = m
    } else if (price.trim()) {
      changes.price = price.trim()
    }
    if (cost.trim()) changes.cost = cost.trim()
    if (category.trim()) changes.category = category.trim()
    if (expiry.trim()) changes.expiry_date = expiry.trim()

    if (Object.keys(changes).length === 0) {
      toast.error("لم تحدّد أي تعديل")
      return
    }
    setSaving(true)
    try {
      const res = await bulkUpdateMedications({ ...target, changes })
      const { updated, audit_id, can_undo } = res.data
      // Every bulk edit is logged and (while snapshotted) reversible — the undo
      // is offered right where the mistake would be noticed.
      toast.success(`تم تعديل ${formatNumber(updated)} صنف`, {
        duration: 12_000,
        action: can_undo
          ? {
              label: "تراجع",
              onClick: async () => {
                try {
                  const u = await undoAudit(audit_id)
                  toast.success(
                    `تم التراجع — أُعيد ${formatNumber(u.data.restored)} صنف`,
                  )
                  onDone?.(0)
                } catch {
                  toast.error("تعذّر التراجع")
                }
              },
            }
          : undefined,
      })
      onDone?.(updated)
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التعديل الجماعي")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4.5 text-primary" />
            تعديل جماعي
          </DialogTitle>
          <DialogDescription>
            سيُطبَّق على <b>{formatNumber(count)}</b> صنف ضمن «{filterLabel}». لا
            يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* The headline repair: derive each price from its own cost. */}
          <div className="clay-well space-y-2 p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                احتساب السعر من التكلفة
              </span>
              <Switch
                checked={useMargin}
                onCheckedChange={(v) => setUseMargin(Boolean(v))}
              />
            </label>
            {useMargin && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">نسبة الربح %</Label>
                <Input
                  type="number"
                  min={0}
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="h-8 w-24 text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">
                  السعر = التكلفة × {(1 + (Number(margin) || 0) / 100).toFixed(2)}
                </span>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              تُعدَّل فقط الأصناف التي لها تكلفة مسجّلة — الأصناف بلا تكلفة تبقى
              كما هي.
            </p>
          </div>

          {!useMargin && (
            <div className="flex flex-col gap-1.5">
              <Label>السعر لكل الأصناف (₪)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="اتركه فارغاً لعدم التغيير"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>التكلفة (₪)</Label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="بدون تغيير"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>التصنيف</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="بدون تغيير"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>تاريخ انتهاء الصلاحية</Label>
            <DatePicker value={expiry} onChange={setExpiry} />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button onClick={apply} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            تطبيق على {formatNumber(count)} صنف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
