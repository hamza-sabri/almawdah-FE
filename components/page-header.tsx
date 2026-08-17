export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  // Tight header: the greeting row is gone, so the title sits high near the
  // brand and the page content starts sooner (less scrolling).
  return (
    <div className="-mt-2 mb-3 flex items-start justify-between gap-3 md:mb-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-brand-gradient"
        />
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-balance md:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground text-pretty md:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
