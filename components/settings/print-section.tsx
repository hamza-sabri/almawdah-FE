"use client"

import { useEffect, useState } from "react"

import { PrintAgentCard } from "@/components/print/print-agent-card"
import {
  DEFAULT_PRINT_SETTINGS,
  loadPrintSettings,
  savePrintSettings,
  type PaperWidth,
  type PrintSettings,
} from "@/lib/print/settings"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Printing, on the settings page.
 *
 * These controls also live in the dialog behind the POS's printer icon, but
 * that dialog is only reachable from the till — so the owner setting the shop
 * up on his own laptop had no way to reach any of it. Anything a person has to
 * be TOLD where to find is in the wrong place.
 *
 * Settings are per browser (localStorage): each counter has its own printer
 * and its own roll.
 */
export function PrintSection() {
  const [s, setS] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [ready, setReady] = useState(false)

  // localStorage is not available while the page is server-rendered; reading
  // it after mount keeps the first paint identical on both sides.
  useEffect(() => {
    setS(loadPrintSettings())
    setReady(true)
  }, [])

  function patch(p: Partial<PrintSettings>) {
    setS((prev) => {
      const next = { ...prev, ...p }
      savePrintSettings(next)
      return next
    })
  }

  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <h2 className="mb-1 font-heading text-base font-bold">الطباعة</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        الطابعة، مقاس الورق، وطباعة الفواتير تلقائياً
      </p>

      <div className={cn("space-y-4", !ready && "opacity-60")}>
        <PrintAgentCard />

        {/* Where a receipt goes */}
        <div className="space-y-1.5">
          <Label>عند الطباعة</Label>
          <div className="flex gap-2">
            {(
              [
                ["print", "أطبع على الطابعة"],
                ["download", "نزّل الفاتورة (لا توجد طابعة)"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => patch({ deliver: v })}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  s.deliver === v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Paper width */}
        <div className="space-y-1.5">
          <Label>مقاس الورق</Label>
          <div className="flex gap-2">
            {(["58", "80"] as PaperWidth[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => patch({ paper: w })}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  s.paper === w
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                {w} مم
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            قِس عرض بكرة الورق. الاختيار الخاطئ يقصّ حواف الفاتورة.
          </p>
        </div>

        {/* Auto print */}
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-semibold">طباعة تلقائية بعد كل بيع</p>
            <p className="text-[11px] text-muted-foreground">
              بدونها تُطبع الفاتورة فقط عند الضغط على زر الطابعة
            </p>
          </div>
          <Switch
            checked={s.autoPrint}
            onCheckedChange={(v) => patch({ autoPrint: Boolean(v) })}
          />
        </div>

        {/* Barcode */}
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-semibold">باركود الفاتورة</p>
            <p className="text-[11px] text-muted-foreground">
              يُطبع أسفل الفاتورة — امسحه في صفحة المبيعات للوصول إليها مباشرة
            </p>
          </div>
          <Switch
            checked={s.receiptBarcode}
            onCheckedChange={(v) => patch({ receiptBarcode: Boolean(v) })}
          />
        </div>
      </div>
    </section>
  )
}
