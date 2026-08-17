"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
import { isActive, type NavItem } from "@/components/nav-config"
import { GlobalScanButton } from "@/components/scan/global-scan-button"
import { useNavItemsWithLock } from "@/lib/modules"
import { useLockedFeature } from "@/components/locked-feature"
import { cn } from "@/lib/utils"

/**
 * Floating ink pill bar with a raised lime scan button in the middle — the
 * app's main mobile navigation. Every feature shows; ones this account can't
 * use are locked and open a "contact the owner" dialog.
 */
export function BottomNav() {
  const pathname = usePathname()
  const { openLocked } = useLockedFeature()
  const items = useNavItemsWithLock().filter(({ item }) => !item.desktopOnly)
  const half = Math.ceil(items.length / 2)
  const first = items.slice(0, half)
  const last = items.slice(half)

  function Item({ item, locked }: { item: NavItem; locked: boolean }) {
    const active = isActive(pathname, item.href) && !locked
    const Icon = item.icon
    const className = cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors",
      active ? "text-lime" : locked ? "text-white/40" : "text-white/55 hover:text-white",
    )
    const inner = (
      <>
        <span
          className={cn(
            "relative grid size-8 place-items-center rounded-xl transition-colors",
            active && "bg-white/10",
          )}
        >
          <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
          {locked && (
            <span className="absolute -end-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-ink text-white/85 ring-1 ring-white/15">
              <Lock className="size-2.5" />
            </span>
          )}
        </span>
        {item.label}
      </>
    )
    const anchor = `nav-${item.href.replace("/", "")}`
    return locked ? (
      <button
        type="button"
        data-tour={anchor}
        onClick={() => openLocked(item.module)}
        className={className}
      >
        {inner}
      </button>
    ) : (
      <Link
        href={item.href}
        data-tour={anchor}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {inner}
      </Link>
    )
  }

  return (
    <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 md:hidden">
      <div className="ink-panel flex items-center gap-1 rounded-[24px] px-2 py-1.5 shadow-2xl">
        {first.map(({ item, locked }) => (
          <Item key={item.href} item={item} locked={locked} />
        ))}
        <div className="shrink-0 px-1">
          <GlobalScanButton variant="nav" />
        </div>
        {last.map(({ item, locked }) => (
          <Item key={item.href} item={item} locked={locked} />
        ))}
      </div>
    </nav>
  )
}
