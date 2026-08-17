import { cn } from "@/lib/utils"

/**
 * Wraps a page's search/actions row so it sticks to the top of the scroll
 * area (just under the top bar) with a frosted backdrop.
 */
export function StickyToolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-3 px-4 py-2.5 md:-mx-8 md:px-8",
        "bg-background/80 backdrop-blur-lg",
        className,
      )}
    >
      {children}
    </div>
  )
}
