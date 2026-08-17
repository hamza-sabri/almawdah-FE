"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
const AR_DOW = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/** Pretty label for the trigger, e.g. "01 فبراير 2027". */
function label(v: string) {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m) return ""
  return `${String(d).padStart(2, "0")} ${AR_MONTHS[m - 1]} ${y}`
}

/**
 * A clean, RTL, claymorphic date picker — replaces the browser's native
 * (and unstyleable) date popup. Value is an ISO `YYYY-MM-DD` string, or "".
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const todayISO = iso(today.getFullYear(), today.getMonth(), today.getDate())
  const parsed = value ? value.split("-").map(Number) : null
  const [view, setView] = useState({
    y: parsed ? parsed[0] : today.getFullYear(),
    m: parsed ? parsed[1] - 1 : today.getMonth(),
  })

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border bg-background px-3 text-sm transition",
          "hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-primary" />
        <span
          className={cn("flex-1 text-start", !value && "text-muted-foreground")}
        >
          {value ? label(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            aria-label="مسح التاريخ"
            className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
          >
            <X className="size-3.5" />
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
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {AR_DOW.map((d) => (
            <span
              key={d}
              className="py-1 text-[10px] font-medium text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((d, i) =>
            d == null ? (
              <span key={`e${i}`} />
            ) : (
              (() => {
                const cur = iso(view.y, view.m, d)
                const selected = cur === value
                const isToday = cur === todayISO
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => {
                      onChange(cur)
                      setOpen(false)
                    }}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg text-sm transition",
                      selected
                        ? "bg-primary font-bold text-primary-foreground"
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
              onChange("")
              setOpen(false)
            }}
          >
            مسح
          </button>
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() => {
              onChange(todayISO)
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
