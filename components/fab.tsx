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
}: {
  onClick: () => void
  label?: string
  className?: string
}) {
  return (
    <Button
      onClick={onClick}
      aria-label={label}
      style={{ backgroundImage: BRAND_GRADIENT }}
      className={cn(
        "fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] end-4 z-30 size-14 rounded-full p-0 text-white shadow-xl shadow-primary/35 transition-transform hover:scale-105 active:scale-95 md:hidden",
        className,
      )}
    >
      <Plus className="size-6" />
    </Button>
  )
}
