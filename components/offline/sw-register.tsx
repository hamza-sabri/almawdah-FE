"use client"

import { useEffect } from "react"

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"

/**
 * Registers the offline app-shell service worker (public/sw.js). Runs only in
 * production builds — in dev, Turbopack's HMR and a caching SW fight each other.
 *
 * The `?v=BUILD_ID` changes on every deploy, so the browser fetches a new worker
 * (and, with updateViaCache:"none", never a stale copy). The new worker versions
 * its caches by that id and wipes the previous ones (see sw.js) — no more stale
 * bundles. When it takes over a page that was already controlled, we reload once
 * so the user lands on the new version immediately instead of "sometime later".
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    // Only auto-reload when REPLACING an existing controller (a real update) —
    // not on the very first visit, which has no controller yet.
    if (navigator.serviceWorker.controller) {
      let refreshing = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }

    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${BUILD_ID}`, { updateViaCache: "none" })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          /* SW registration failed (unsupported / blocked) — app still works online */
        })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])
  return null
}
