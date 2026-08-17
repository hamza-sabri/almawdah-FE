"use client"

import { useCallback, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Auto-loads the next page when scrolled into view (with a manual fallback). */
export function LoadMore({
  hasNext,
  isFetchingNext,
  onLoad,
}: {
  hasNext: boolean
  isFetchingNext: boolean
  onLoad: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const trigger = useCallback(() => {
    if (hasNext && !isFetchingNext) onLoad()
  }, [hasNext, isFetchingNext, onLoad])

  useEffect(() => {
    const el = ref.current
    if (!el || !hasNext) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) trigger()
      },
      { rootMargin: "240px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNext, trigger])

  if (!hasNext) return null

  return (
    <div ref={ref} className="flex justify-center py-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={trigger}
        disabled={isFetchingNext}
      >
        {isFetchingNext && <Loader2 className="size-4 animate-spin" />}
        تحميل المزيد
      </Button>
    </div>
  )
}
