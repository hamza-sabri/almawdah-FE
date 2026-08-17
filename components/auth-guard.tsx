"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { isAuthenticated } from "@/lib/tokens"
import { consumeHandoff } from "@/lib/handoff"
import { isGuestDemo } from "@/lib/demo/guest"
import { BrandMark } from "@/components/brand"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    consumeHandoff()
    // Guest demo needs no login — it runs entirely on the in-browser mock.
    if (!isAuthenticated() && !isGuestDemo()) {
      const next = encodeURIComponent(pathname)
      router.replace(`/login?next=${next}`)
    } else {
      setReady(true)
    }
  }, [router, pathname])

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <BrandMark className="size-14" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
