"use client"

import { usePathname } from "next/navigation"

import { NAV_ITEMS } from "@/components/nav-config"
import { hasModule, requiredModuleFor, useIsOwner, useModules } from "@/lib/modules"
import { LockedFeatureNotice } from "@/components/locked-feature"

/**
 * Shows a "feature not enabled" notice for pages the account's modules don't
 * include — instead of hiding or redirecting — so staff can see the feature
 * exists and ask the owner to enable it. Owner-only pages (reports, imports)
 * lock the same way for employee accounts. The API still enforces access
 * (403) server-side.
 *
 * While /me is loading, modules are unknown (hasModule → true), so the page
 * renders normally rather than flashing the notice.
 */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { modules } = useModules()
  const isOwner = useIsOwner()

  // /reports renders its own rich upsell teaser for locked accounts —
  // let it through and it decides what to show (API still enforces).
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return <>{children}</>
  }

  const required = requiredModuleFor(pathname)
  const item = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  )
  if (!hasModule(modules, required) || (item?.ownerOnly && !isOwner)) {
    return <LockedFeatureNotice module={required} />
  }
  return <>{children}</>
}
