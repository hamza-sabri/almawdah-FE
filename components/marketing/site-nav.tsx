"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { getAccessToken } from "@/lib/tokens"
import { BrandLockup } from "@/components/brand"
import { TryDemoButton } from "@/components/marketing/try-demo-button"

export function SiteNav() {
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    setAuthed(Boolean(getAccessToken()))
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label="فارما" className="shrink-0">
          <BrandLockup subtitle={false} />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#features" className="transition hover:text-foreground">
            المميزات
          </Link>
          <Link href="/#pricing" className="transition hover:text-foreground">
            الأسعار
          </Link>
          <Link href="/#demo" className="transition hover:text-foreground">
            النسخة التجريبية
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={authed ? "/pos" : "/login"}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary/40 hover:text-primary"
          >
            {authed ? "لوحتي" : "دخول"}
          </Link>
          <TryDemoButton size="md" label="جرّب" className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  )
}
