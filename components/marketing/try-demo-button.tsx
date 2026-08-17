"use client"

import { Loader2, PlayCircle } from "lucide-react"

import { useDemoLogin } from "@/lib/demo"
import { cn } from "@/lib/utils"

type Props = {
  label?: string
  className?: string
  variant?: "lime" | "ink" | "white"
  size?: "md" | "lg"
}

/** One-click entry into the live demo tenant (no signup). */
export function TryDemoButton({
  label = "جرّب النظام مجاناً",
  className,
  variant = "lime",
  size = "lg",
}: Props) {
  const { start, loading } = useDemoLogin()

  const tone =
    variant === "lime"
      ? "bg-lime text-lime-foreground shadow-lg shadow-lime/30"
      : variant === "white"
        ? "bg-white text-ink shadow-lg shadow-black/10"
        : "bg-ink text-white shadow-lg shadow-ink/25"

  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-heading font-bold transition hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-70",
        size === "lg" ? "h-13 px-7 text-base" : "h-11 px-5 text-sm",
        tone,
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <PlayCircle className="size-5" />
      )}
      {loading ? "جارٍ فتح النسخة التجريبية…" : label}
    </button>
  )
}
