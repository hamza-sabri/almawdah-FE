"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * One field, two dates.
 *
 * The period filter used two native `<input type="date">` boxes side by side.
 * They are unstyleable, they render in the browser's locale rather than the
 * shop's, and — the real problem — nothing tied them together: you could set
 * an end before a start, or set one and wonder why nothing happened.
 *
 * This is a single trigger holding both ends. First click picks the start,
 * second picks the end, and the pair is only reported once BOTH are set, so a
 * half-made range can never be mistaken for a filter.
 *
 * Deliberately the same hand-rolled RTL calendar as DatePicker rather than
 * react-day-picker: the Arabic month/weekday names and the claymorphic styling
 * are already right here, and it adds no dependency.
 */

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
const AR_DOW = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/** "01 فبراير 2027" */
function label(v: string): string {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m) return ""
  return `${String(d).padStart(2, "0")} ${AR_MONTHS[m - 1]} ${y}`
}

export type DateRange = { from: string; to: string }

export function DateRangePicker({
  value,
  onChange,
  placeholder = "اختر فترة",
  className,
}: {
  value: DateRange
  onChange: (v: DateRange) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  /** The start of a range being picked, before its end is chosen. */
  const [anchor, setAnchor] = useState<string | null>(null)

  const today = new Date()
  const todayISO = iso(today.getFullYear(), today.getMonth(), today.getDate())
  const seed = value.from || value.to || todayISO
  const parsed = seed.split("-").map(Number)
  const [view, setView] = useState({ y: parsed[0], m: parsed[1] - 1 })

  const cells = useMemo(() => {
    const lead = new Date(view.y, view.m, 1).getDay() // 0 = Sunday
    const days = new Date(view.y, view.m + 1, 0).getDate()
    const out: (number | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) out.push(d)
    return out
  }, [view])

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.m + delta
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })

  function pick(day: string) {
    if (!anchor) {
      setAnchor(day)
      return
    }
    // Picked backwards? Read it the way round the cashier plainly meant.
    const [from, to] = anchor <= day ? [anchor, day] : [day, anchor]
    setAnchor(null)
    onChange({ from, to })
    setOpen(false)
  }

  function clear() {
    setAnchor(null)
    onChange({ from: "", to: "" })
  }

  const complete = Boolean(value.from && value.to)
  const triggerText = complete
    ? `${label(value.from)} — ${label(value.to)}`
    : anchor
      ? `${label(anchor)} — …`
      : placeholder

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // Closing mid-pick abandons the half-range rather than leaving a
        // dangling start that silently changes the next click's meaning.
        if (!o) setAnchor(null)
      }}
    >
      <PopoverTrigger
        className={cn(
          "flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-xs transition",
          "hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          complete && "border-primary text-primary",
          className,
        )}
      >
        <CalendarDays className="size-3.5 shrink-0" />
        <span className={cn(!complete && !anchor && "text-muted-foreground")}>
          {triggerText}
        </span>
        {complete && (
          <span
            role="button"
            aria-label="مسح الفترة"
            className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              clear()
            }}
          >
            <X className="size-3" />
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-[17.5rem] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="الشهر السابق"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="font-heading text-sm font-bold">
            {AR_MONTHS[view.m]} {view.y}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="الشهر التالي"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <p className="mb-1.5 text-center text-[10px] text-muted-foreground">
          {anchor ? "اختر تاريخ النهاية" : "اختر تاريخ البداية"}
        </p>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {AR_DOW.map((d) => (
            <span key={d} className="py-1 text-[10px] font-medium text-muted-foreground">
              {d}
            </span>
          ))}
          {cells.map((d, i) =>
            d == null ? (
              <span key={`e${i}`} />
            ) : (
              (() => {
                const cur = iso(view.y, view.m, d)
                const isEnd = cur === value.from || cur === value.to || cur === anchor
                const inRange =
                  complete && !isEnd && cur > value.from && cur < value.to
                const isToday = cur === todayISO
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => pick(cur)}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg text-sm transition",
                      isEnd
                        ? "bg-primary font-bold text-primary-foreground"
                        : inRange
                          ? "bg-primary/15 text-primary"
                          : isToday
                            ? "bg-primary/10 font-bold text-primary"
                            : "hover:bg-muted",
                    )}
                  >
                    {formatNumber(d)}
                  </button>
                )
              })()
            ),
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              clear()
              setOpen(false)
            }}
          >
            مسح
          </button>
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() => {
              setAnchor(null)
              onChange({ from: todayISO, to: todayISO })
              setView({ y: today.getFullYear(), m: today.getMonth() })
              setOpen(false)
            }}
          >
            اليوم
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
