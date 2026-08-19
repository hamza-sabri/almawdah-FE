"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Plus, X } from "lucide-react"

import { sanitizeQtyInput } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * "Add anything" — the strip under the cart.
 *
 * A supermarket sells things the catalogue does not have: a one-off item, a
 * service, a deposit, something the owner priced at the counter. Without this
 * the cashier's only options were to refuse the sale or to invent a product
 * row, which pollutes the catalogue forever and still has to be priced.
 *
 * It writes the same free-text line the top-up buttons use — a name and a
 * price, no product id — so it rings up, prints and reports like any other
 * line, and it works offline for the same reason: nothing is looked up.
 *
 * It lives OUTSIDE the cart's scroll box on purpose. It started as the last
 * row of the table, then as a sticky <tfoot>; both slid out of reach once the
 * cart was longer than the screen, because the page — not the card — is what
 * actually scrolls at some widths. Sitting between the table and the payment
 * buttons it is always where the cashier last looked, whatever the cart holds.
 */
export function ManualLineRow({
  onAdd,
  className,
}: {
  onAdd: (name: string, price: number, quantity: number) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [qty, setQty] = useState("1")
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) nameRef.current?.focus()
  }, [open])

  function reset() {
    setName("")
    setPrice("")
    setQty("1")
  }

  const priceNum = parseFloat(price)
  const qtyNum = parseFloat(qty)
  // A nameless line prints blank on the receipt and a zero-price line is
  // almost always a mis-tap, so neither can be committed.
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    Number.isFinite(qtyNum) &&
    qtyNum > 0

  function commit() {
    if (!valid) return
    onAdd(name.trim(), priceNum, qtyNum)
    reset()
    // Stay open: entering two or three of these in a row is the common case.
    nameRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      reset()
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          // Always the highlighted state, not just on hover: a grey dashed box
          // read as a disabled placeholder, and on a touch till there is no
          // hover to discover it with.
          "flex w-full shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/50 bg-primary/5 py-2.5 text-sm font-semibold text-primary transition",
          "hover:border-primary hover:bg-primary/10",
          className,
        )}
      >
        <Plus className="size-4" />
        إضافة صنف يدوي
      </button>
    )
  }

  const field =
    "h-9 rounded-xl border bg-card px-2 text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary/30"

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-2",
        className,
      )}
    >
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
        placeholder="اسم الصنف"
        aria-label="اسم الصنف"
        className={cn(field, "min-w-40 flex-1 text-start font-medium")}
      />
      <input
        value={price}
        onChange={(e) => setPrice(sanitizeQtyInput(e.target.value))}
        onKeyDown={onKey}
        inputMode="decimal"
        dir="ltr"
        placeholder="السعر"
        aria-label="السعر"
        className={cn(field, "w-24")}
      />
      <span className="text-muted-foreground">×</span>
      <input
        value={qty}
        onChange={(e) => setQty(sanitizeQtyInput(e.target.value))}
        onKeyDown={onKey}
        inputMode="decimal"
        dir="ltr"
        aria-label="الكمية"
        className={cn(field, "w-20")}
      />
      <span className="min-w-20 text-center font-heading text-sm font-bold tabular-nums">
        {valid ? (priceNum * qtyNum).toFixed(2) : "—"}
      </span>
      <button
        type="button"
        onClick={commit}
        disabled={!valid}
        aria-label="إضافة إلى السلة"
        title="إضافة إلى السلة"
        className="grid size-9 place-items-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:opacity-30"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          reset()
          setOpen(false)
        }}
        aria-label="إلغاء"
        title="إلغاء"
        className="grid size-9 place-items-center rounded-xl text-muted-foreground/70 transition hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
