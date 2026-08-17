"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Lock, LogOut, PanelLeft, Settings } from "lucide-react"
import { toast } from "sonner"

import { logout } from "@/lib/auth"
import { isActive } from "@/components/nav-config"
import { useIsOwner, useNavItemsWithLock } from "@/lib/modules"
import { useLockedFeature } from "@/components/locked-feature"
import { BrandLockup, BrandMark } from "@/components/brand"
import { ConfirmDelete } from "@/components/confirm-delete"
import { ExportDialog } from "@/components/export-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Floating ink rail — the app's signature dark surface. Collapses to icons-only
 *  by default (small screens) and re-collapses whenever the route changes. */
export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  // Collapsed (icons only) by default; expand is temporary — any navigation
  // re-collapses it so the rail stays out of the way on small screens.
  const [collapsed, setCollapsed] = useState(true)
  useEffect(() => {
    setCollapsed(true)
  }, [pathname])

  const isOwner = useIsOwner()
  // Every feature is shown; ones this account can't use are locked.
  const navItems = useNavItemsWithLock()
  const { openLocked } = useLockedFeature()

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    qc.clear() // drop this account's cached data
    toast.success("تم تسجيل الخروج")
    router.replace("/login")
  }

  // Shared classes for the footer utility rows (QR / Settings / logout).
  const rowCls = (danger = false) =>
    cn(
      "mt-1 flex w-full items-center rounded-2xl py-2.5 text-sm font-medium text-white/55 transition-all hover:text-white",
      collapsed ? "justify-center px-0" : "gap-3 px-3.5",
      danger ? "hover:bg-destructive/20" : "hover:bg-white/8",
    )

  return (
    <TooltipProvider>
    <aside className="hidden shrink-0 p-4 pe-0 md:block">
      <div
        className={cn(
          "ink-rail ink-panel flex h-full flex-col rounded-[26px] transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Header: brand + collapse toggle */}
        <div
          className={cn(
            "flex pb-4 pt-6",
            collapsed ? "flex-col items-center gap-3 px-2" : "items-center justify-between px-5",
          )}
        >
          {collapsed ? <BrandMark className="size-8" /> : <BrandLockup tone="ink" />}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "توسيع الشريط" : "طيّ الشريط"}
            title={collapsed ? "توسيع" : "طيّ"}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeft className="size-5" />
          </button>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-1.5 overflow-y-auto pt-2",
            collapsed ? "px-2" : "px-3.5",
          )}
        >
          {navItems.map(({ item, locked }) => {
            const active = isActive(pathname, item.href) && !locked
            const Icon = item.icon
            const className = cn(
              "group flex items-center rounded-2xl py-2.5 text-sm font-medium transition-all",
              collapsed ? "justify-center px-0" : "gap-3 px-3.5",
              active
                ? "text-white shadow-lg shadow-primary/30"
                : locked
                  ? "text-white/35 hover:bg-white/5 hover:text-white/60"
                  : "text-white/60 hover:bg-white/8 hover:text-white",
            )
            const inner = collapsed ? (
              <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
            ) : (
              <>
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                <span className="flex-1">{item.label}</span>
                {locked ? (
                  <Lock aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
                ) : active ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-lime shadow-[0_0_8px_1px_var(--lime)]"
                  />
                ) : null}
              </>
            )
            const activeStyle = active
              ? { backgroundImage: "linear-gradient(135deg, var(--primary), var(--chart-2))" }
              : undefined
            const el = locked ? (
              <button
                key={item.href}
                type="button"
                data-tour={`nav-${item.href.replace("/", "")}`}
                onClick={() => openLocked(item.module)}
                className={cn(className, "text-start")}
              >
                {inner}
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav-${item.href.replace("/", "")}`}
                aria-current={active ? "page" : undefined}
                style={activeStyle}
                className={className}
              >
                {inner}
              </Link>
            )
            // Collapsed rail → show the label as a hover tooltip (portal, so it
            // isn't clipped by the nav's overflow). Expanded shows the label inline.
            if (!collapsed) return el
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={el} />
                <TooltipContent side="left">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Footer utilities — Export, Settings, logout. Scan + theme moved to
            the bottom nav / Settings respectively. Export is a full dump of the
            store's own data, so it's owner-only (enforced server-side too). */}
        <div className={cn("pb-3.5 pt-2", collapsed ? "px-2" : "px-3.5")}>
          {isOwner && (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              title={collapsed ? "تصدير البيانات" : undefined}
              className={rowCls()}
            >
              <Download className="size-5 shrink-0" />
              {!collapsed && <span>تصدير البيانات</span>}
            </button>
          )}
          <Link href="/settings" title={collapsed ? "الإعدادات" : undefined} className={rowCls()}>
            <Settings className="size-5 shrink-0" />
            {!collapsed && <span>الإعدادات</span>}
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            title={collapsed ? "تسجيل الخروج" : undefined}
            className={rowCls(true)}
          >
            <LogOut className="size-5 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>

          <ConfirmDelete
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            onConfirm={handleLogout}
            loading={loggingOut}
            title="تسجيل الخروج"
            description="هل تريد تسجيل الخروج؟"
            confirmLabel="تسجيل الخروج"
            confirmIcon={<LogOut className="size-4" />}
          />
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
          {!collapsed && (
            <p className="pt-2 text-center text-[10px] tracking-wide text-white/35">
              نظام إدارة المتجر
            </p>
          )}
        </div>
      </div>
    </aside>
    </TooltipProvider>
  )
}
