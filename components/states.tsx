"use client"

import { Inbox, RefreshCw, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorArt } from "@/components/illustrations"

export function ErrorState({
  onRetry,
  message = "تعذر تحميل البيانات",
}: {
  onRetry?: () => void
  message?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/60 p-10 text-center">
      <ErrorArt className="h-28 w-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  art,
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  art?: React.ReactNode
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/60 p-10 text-center">
      {art ? (
        <div className="drop-shadow-sm">{art}</div>
      ) : (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
      )}
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
