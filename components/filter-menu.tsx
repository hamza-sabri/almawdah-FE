"use client"

import { useState } from "react"
import { Funnel } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FilterChips, type ChipOption } from "@/components/filter-chips"
import { cn } from "@/lib/utils"

export type FilterGroup = {
  label: string
  value: string
  onChange: (v: string) => void
  options: ChipOption[]
  /** Value considered "no filter" (for the active dot). */
  defaultValue?: string
}

/** Funnel icon button → popover holding the page's filter chip groups. */
export function FilterMenu({ groups }: { groups: FilterGroup[] }) {
  const [open, setOpen] = useState(false)
  const active = groups.some((g) => g.value !== (g.defaultValue ?? "all"))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="الفلاتر"
            title="الفلاتر"
            className={cn(
              "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition",
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-primary",
            )}
          >
            <Funnel className="size-4.5" />
            {active && (
              <span className="absolute end-1 top-1 size-2 rounded-full bg-lime shadow-[0_0_6px_1px_var(--lime)]" />
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-72 space-y-3.5 rounded-2xl p-4">
        {groups.map((g) => (
          <div key={g.label} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              {g.label}
            </p>
            <FilterChips
              value={g.value}
              onChange={(v) => {
                g.onChange(v)
                setOpen(false)
              }}
              options={g.options}
            />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
