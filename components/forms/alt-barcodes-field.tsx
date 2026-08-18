"use client"

import { useState } from "react"
import { Plus, ScanBarcode, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Extra scannable barcodes for one product.
 *
 * A shop item routinely carries more than one code — the shelf label, the
 * supplier's box, a re-printed sticker, the unit code on a multipack. Any of
 * them must resolve the product at the till, so the cashier never has to know
 * which sticker is "the real one".
 *
 * Deliberately unbounded: the number varies per item and per supplier, and a
 * cap here would just be a number someone picked. The server refuses a code
 * another product already claims, which is the constraint that actually
 * matters — two products answering the same scan makes the till a coin toss.
 */
export function AltBarcodesField({
  value,
  onChange,
  onScan,
}: {
  value: string[]
  onChange: (next: string[]) => void
  /** Opens the camera scanner; resolves with the scanned code. */
  onScan?: () => void
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")

  function add(raw: string) {
    const code = raw.trim()
    if (!code) return
    if (value.includes(code)) {
      setError("هذا الباركود مضاف بالفعل")
      return
    }
    setError("")
    onChange([...value, code])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            dir="ltr"
            value={draft}
            placeholder="امسح أو أدخل باركود إضافي"
            className={cn("text-right", onScan && "pl-12")}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError("")
            }}
            onKeyDown={(e) => {
              // A scanner ends its burst with Enter — that must ADD the code,
              // not submit the whole product form.
              if (e.key === "Enter") {
                e.preventDefault()
                e.stopPropagation()
                add(draft)
              }
            }}
          />
          {onScan && (
            <button
              type="button"
              onClick={onScan}
              aria-label="مسح باركود إضافي بالكاميرا"
              className="absolute inset-y-0 end-1.5 my-auto grid size-8 place-items-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary/15"
            >
              <ScanBarcode className="size-4.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15 disabled:opacity-40"
          aria-label="إضافة الباركود"
        >
          <Plus className="size-4.5" />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 py-1 ps-1.5 pe-2.5 text-xs font-medium tabular-nums"
              dir="ltr"
            >
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                aria-label={`حذف الباركود ${code}`}
                className="grid size-4 place-items-center rounded text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
              {code}
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        كل باركود هنا يفتح نفس الصنف عند المسح — نفس السعر ونفس المخزون.
      </p>
    </div>
  )
}
