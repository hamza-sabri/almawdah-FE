"use client"

import { ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"

/**
 * Prev / next pager with a "page X of Y" readout and total count.
 * RTL-aware: "previous" points right, "next" points left.
 */
export function PaginationBar({
  page,
  pageCount,
  count,
  onPage,
  loading = false,
}: {
  page: number
  pageCount: number
  count: number
  onPage: (p: number) => void
  loading?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">
        {formatNumber(count)} سجل · صفحة {formatNumber(page)} من{" "}
        {formatNumber(pageCount)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
        >
          <ChevronRight className="size-4" />
          السابق
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount || loading}
          onClick={() => onPage(page + 1)}
        >
          التالي
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  )
}
