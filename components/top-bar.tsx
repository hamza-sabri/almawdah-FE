"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { BarChart3, GraduationCap, LogOut, Moon, QrCode, ReceiptText, Settings, Sun, Users } from "lucide-react"
import { toast } from "sonner"

import { logout } from "@/lib/auth"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMe, displayName } from "@/hooks/use-me"
import { useBranding } from "@/hooks/use-branding"
import { useIsOwner } from "@/lib/modules"
import { BrandMark } from "@/components/brand"
import { PriceQrDialog } from "@/components/reports/price-qr-card"
import { GlobalScanButton } from "@/components/scan/global-scan-button"
import { ConfirmDelete } from "@/components/confirm-delete"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"

export function TopBar() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, isLoading } = useMe()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = mounted && resolvedTheme === "dark"
  useEffect(() => setMounted(true), [])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    qc.clear() // drop this account's cached data
    toast.success("تم تسجيل الخروج")
    router.replace("/login")
  }

  const name = displayName(user)
  const initials = name ? name.charAt(0) : "؟"
  const { name: brandName } = useBranding()
  const isOwner = useIsOwner()
  const [qrOpen, setQrOpen] = useState(false)

  const avatar = isLoading ? (
    <Skeleton className="size-9 rounded-full" />
  ) : (
    <Avatar className="size-9 shadow-sm">
      <AvatarImage src={user?.avatar || undefined} alt={name} />
      {/* Ink + lime — same scheme as the bottom nav. */}
      <AvatarFallback className="bg-ink text-sm font-bold text-lime">
        {initials}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] md:px-8 md:pt-2">
      {/* Mobile brand — the tenant's app icon, so the app bar matches the launcher. */}
      <div className="flex items-center gap-2.5 md:hidden">
        <BrandMark className="size-10 rounded-xl ring-1 ring-border" />
        <p className="font-heading text-lg font-bold tracking-tight">
          {brandName}
        </p>
      </div>

      {/* No greeting — each page's own title/description is the heading, which
          frees this space. Spacer keeps the actions pinned to the end. */}
      <div className="hidden md:block" aria-hidden />

      <div className="flex items-center gap-2.5">
        {/* Scan lives in the bottom nav on mobile — desktop only here. */}
        <GlobalScanButton variant="chrome" className="hidden md:inline-flex" />

        {/* Mobile: the price-page QR sits right next to the profile circle.
            Available to EVERY signed-in member of staff, not just the owner —
            it's a poster to hand a customer, not a management report. */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="QR صفحة الأسعار"
          className="flex size-9 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border transition hover:bg-muted md:hidden"
        >
          <QrCode className="size-4.5" />
        </button>

        {/* Mobile: profile menu — appearance (theme) + logout. Uses Base UI's
            render-prop trigger (same pattern as SortMenu / RowActions). */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="الحساب" className="rounded-full md:hidden">
                {avatar}
              </button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            {/* Plain <div> headers/dividers — NOT DropdownMenuLabel, which is
                Base UI's Menu.GroupLabel and throws (#31) unless wrapped in a
                Menu.Group. Items below stay as real Menu.Items. */}
            {name ? (
              <div className="truncate px-1.5 py-1 text-sm font-bold">{name}</div>
            ) : null}
            <div className="-mx-1 my-1 h-px bg-border" />
            <div className="flex items-center justify-between gap-3 px-1.5 py-1.5">
              <span className="flex items-center gap-2 text-sm">
                {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                المظهر
              </span>
              <Switch
                checked={isDark}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                aria-label="تبديل بين الفاتح والداكن"
              />
            </div>
            <DropdownMenuItem onClick={() => router.push("/customers")}>
              <Users className="size-4" />
              الزبائن
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/debts")}>
              <ReceiptText className="size-4" />
              الديون
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={() => router.push("/reports")}>
                <BarChart3 className="size-4" />
                التقارير
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" />
              الإعدادات
            </DropdownMenuItem>
            <div className="-mx-1 my-1 h-px bg-border" />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <LogOut className="size-4" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Desktop: display only — logout lives in the sidebar. */}
        <div className="hidden md:block" title={name}>
          {avatar}
        </div>
      </div>

      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleLogout}
        loading={loggingOut}
        title="تسجيل الخروج"
        description={`هل تريد تسجيل الخروج${name ? ` يا ${name}` : ""}؟`}
        confirmLabel="تسجيل الخروج"
        confirmIcon={<LogOut className="size-4" />}
      />
      <PriceQrDialog open={qrOpen} onOpenChange={setQrOpen} />
    </header>
  )
}
