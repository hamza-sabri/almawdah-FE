"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

/** Light / Dark / System — shared by the sidebar switch and the mobile menu. */
export const THEME_OPTIONS = [
  { value: "light", label: "فاتح", Icon: Sun },
  { value: "dark", label: "داكن", Icon: Moon },
  { value: "system", label: "تلقائي", Icon: Monitor },
] as const

/**
 * Small segmented Light / Dark / System switch.
 * `tone="rail"` styles it for the dark sidebar; `"surface"` for normal cards.
 */
export function ThemeToggle({
  tone = "surface",
  className,
}: {
  tone?: "rail" | "surface"
  className?: string
}) {
  const { theme, setTheme } = useTheme()
  // Avoid a hydration mismatch: the active state is only known on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const current = mounted ? theme : undefined

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-1",
        tone === "rail" ? "bg-white/8 ring-1 ring-white/10" : "bg-muted",
        className,
      )}
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition",
              active
                ? tone === "rail"
                  ? "bg-lime text-lime-foreground"
                  : "bg-card text-foreground shadow-sm"
                : tone === "rail"
                  ? "text-white/55 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
