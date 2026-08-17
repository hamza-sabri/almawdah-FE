"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, LogOut } from "lucide-react"

import { isGuestDemo, endGuestDemo } from "@/lib/demo/guest"

/** Slim badge shown while in the no-login guest demo. */
export function DemoBanner() {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setShow(isGuestDemo())
  }, [])

  if (!show) return null

  function exit() {
    endGuestDemo()
    window.location.href = "/"
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-black/10">
        <FlaskConical className="size-3.5 text-lime" />
        <span>وضع تجريبي — بياناتك محلية ولا تُحفَظ في أي مكان</span>
        <button
          type="button"
          onClick={exit}
          className="ms-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 transition hover:bg-white/25"
        >
          <LogOut className="size-3" />
          خروج
        </button>
      </div>
    </div>
  )
}
