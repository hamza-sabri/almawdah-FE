"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type SegmentOption<T extends string> = {
  value: T
  label: ReactNode
  /** Optional trailing adornment (e.g. a lock icon). */
  adornment?: ReactNode
}

/**
 * iOS-style segmented control: the options read as one pill and a selector
 * slides between them. RTL-safe — the indicator is offset with the physical
 * `right` property (the app is RTL-only), which animates reliably.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: "sm" | "md"
  className?: string
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const pct = 100 / Math.max(1, options.length)
  return (
    <div
      role="tablist"
      className={cn("clay-well relative inline-grid rounded-full", className)}
      // Equal columns regardless of label length, so the sliding indicator
      // lines up exactly (flex items size to their text and drift).
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 rounded-full bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.35)] transition-[right,width] duration-300 ease-out"
        style={{
          width: `calc(${pct}% - 0.5rem)`,
          right: `calc(${idx} * ${pct}% + 0.25rem)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            o.value === value
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.adornment}
        </button>
      ))}
    </div>
  )
}
