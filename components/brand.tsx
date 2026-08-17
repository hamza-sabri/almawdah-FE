"use client"

import { useState } from "react"

import { useBranding } from "@/hooks/use-branding"
import { DEFAULT_ICON_192 } from "@/lib/branding"
import { cn } from "@/lib/utils"

/**
 * The app icon — the tenant store's own logo when it has one, else the
 * generic Pharma icon (matches the launcher/PWA icon everywhere). Falls back
 * to the default mark if the logo URL fails to load (e.g. an expired signed
 * URL while the tab sat open).
 */
export function BrandMark({ className }: { className?: string }) {
  const { logo } = useBranding()
  const [broken, setBroken] = useState(false)
  const custom = !broken && Boolean(logo)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={custom ? logo : DEFAULT_ICON_192}
      alt=""
      aria-hidden="true"
      onError={() => setBroken(true)}
      className={cn(
        "rounded-2xl shadow-sm",
        custom ? "bg-white object-contain" : "object-cover",
        className,
      )}
    />
  )
}

export function BrandLockup({
  className,
  subtitle = true,
  tone = "default",
}: {
  className?: string
  subtitle?: boolean
  tone?: "default" | "ink"
}) {
  const { name } = useBranding()
  const ink = tone === "ink"
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className="size-10" />
      <div className="leading-tight">
        <p
          className={cn(
            "font-heading text-lg font-bold tracking-tight",
            ink && "text-white",
          )}
        >
          {name}
        </p>
        {subtitle && (
          <p
            className={cn(
              "text-xs",
              ink ? "text-white/55" : "text-muted-foreground",
            )}
          >
            لوحة التحكم
          </p>
        )}
      </div>
    </div>
  )
}
