"use client"

import { useEffect, useRef, useState } from "react"
import { Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Mobile top-up: جوال.
 *
 * Phone credit was the shop's SECOND most-transacted line in the old system —
 * 3,145 sales, ₪83,575 — under a single catalogue item called "شحن رصيد" with
 * no barcode and a nominal ₪1 price, so the cashier had to key the real amount
 * every time and the two networks were indistinguishable afterwards.
 *
 * These sell as free-text lines (a name and a price, no catalogue product):
 * top-up has no stock to decrement and no barcode to scan, and inventing 2,000
 * catalogue rows for every possible amount would be worse. The sale records
 * them exactly like any other line, so they appear in the receipt, the totals
 * and the reports — now split by network.
 *
 * Tapping a network adds NOTHING. It only opens the amounts. The line is
 * created once, when an amount is chosen. An earlier version also sold ₪10 on
 * the first tap to save a keystroke — it put a phantom ₪10 line on the receipt
 * every time the cashier actually wanted ₪50, which is money out of the till.
 */

// وطنية removed at the owner's request — this shop only sells جوال credit.
export const TOPUP_NETWORKS = [{ key: "jawwal", label: "جوال" }] as const

/** ₪10 first because it is the common sale — it is a default position, not a
 * default charge. Nothing is added until one of these is pressed. */
export const TOPUP_AMOUNTS = [10, 20, 30, 50, 100] as const

export function topupName(label: string): string {
  return `تعبئة كرت ${label}`
}

export function TopupButtons({
  onAdd,
}: {
  /** name shown on the receipt, and the amount charged */
  onAdd: (name: string, amount: number) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // A picker left hanging open over the till is its own hazard: the next
  // barcode lands behind a floating panel and the cashier taps an amount they
  // never meant to. Anything outside it, or Escape, closes it.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
    }
    document.addEventListener("pointerdown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("pointerdown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-1.5">
      {TOPUP_NETWORKS.map((n) => {
        const isOpen = open === n.key
        return (
          <div key={n.key} className="relative">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : n.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              title={`تعبئة كرت ${n.label} — اختر المبلغ`}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
                isOpen
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Smartphone className="size-4" />
              {n.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={`مبلغ تعبئة ${n.label}`}
                className="animate-in fade-in zoom-in-95 absolute top-full start-0 z-20 mt-1 flex gap-1 rounded-xl border bg-card p-1 shadow-lg duration-100"
              >
                {TOPUP_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd(topupName(n.label), amt)
                      setOpen(null)
                    }}
                    className="min-w-10 rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums transition hover:bg-primary/10 hover:text-primary"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
