"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useTour } from "@/components/tour/tour-provider"
import { getTour } from "@/lib/tour/tours"

/**
 * Lets a URL start a guided tour: `/reports?demo=1&tour=reports`.
 *
 * This is what makes the marketing site's "try the thing you're afraid of"
 * cards work — each card deep-links a visitor straight into the guest demo
 * with the relevant walkthrough running, no signup, no full reload, and
 * nothing saved. Also handy in WhatsApp messages to hesitant store owners:
 * send them one link that lands them inside the exact feature they doubted.
 */
function TourFromQueryInner() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { startTour, active } = useTour()
  const fired = useRef(false)

  useEffect(() => {
    const id = params.get("tour")
    if (!id || fired.current || active) return
    if (!getTour(id)) return
    fired.current = true
    // Small delay so hydration settles and the guest-demo flag (set by
    // AuthGuard reading ?demo=1) is in place before API calls are swapped.
    const t = setTimeout(() => {
      startTour(id)
      // Drop the params — the tour is running and the demo flag lives in
      // sessionStorage, so the URL can go back to clean.
      router.replace(pathname)
    }, 450)
    return () => clearTimeout(t)
  }, [params, pathname, router, startTour, active])

  return null
}

export function TourFromQuery() {
  return (
    <Suspense fallback={null}>
      <TourFromQueryInner />
    </Suspense>
  )
}
