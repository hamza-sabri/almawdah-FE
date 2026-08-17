"use client"

import { useEffect, useState } from "react"

/**
 * Live online/offline status. Seeds from `navigator.onLine` and tracks the
 * window online/offline events. `navigator.onLine` only knows about the
 * network interface (not whether our API is actually reachable), so the sync
 * layer still treats a failed request as "offline" — this hook drives the UX
 * indicator and kicks a flush when connectivity returns.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener("online", up)
    window.addEventListener("offline", down)
    return () => {
      window.removeEventListener("online", up)
      window.removeEventListener("offline", down)
    }
  }, [])

  return online
}
