"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const BRAND_GRADIENT = "linear-gradient(135deg, var(--primary), var(--chart-2))"

/** Floating action button — sits above the mobile bottom nav. */
export function Fab({
  onClick,
  label = "إضافة",
  className,
  always = false,
}: {
  onClick: () => void
  label?: string
  className?: string
  /**
   * Keep it on screen at desktop widths too, next to the toolbar button
   * rather than instead of it.
   *
   * The till is a wide screen, and on a long inventory list the toolbar
   * scrolls away — so "add a product" was a scroll to the top away, on the one
   * page where the owner adds things all day. On desktop there is no bottom
   * nav to clear, so it sits lower.
   */
  always?: boolean
}) {
  return (
    <Button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ backgroundImage: BRAND_GRADIENT }}
      className={cn(
        "fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] end-4 z-30 size-14 rounded-full p-0 text-white shadow-xl shadow-primary/35 transition-transform hover:scale-105 active:scale-95",
        always ? "md:bottom-6" : "md:hidden",
        className,
      )}
    >
      <Plus className="size-6" />
    </Button>
  )
}
