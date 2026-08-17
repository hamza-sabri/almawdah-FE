"use client"

import { cn } from "@/lib/utils"

export type ChipOption = { value: string; label: string }

/** A row of pill filter chips — the hub's primary filtering control. */
export function FilterChips({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: ChipOption[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
              active
                ? "bg-ink text-white shadow-md shadow-ink/25"
                : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
