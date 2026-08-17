"use client"

import { useEffect } from "react"

/**
 * Keep the screen in PORTRAIT while a scanner is open.
 *
 * Rotating the phone mid-scan used to re-layout the camera view (and on some
 * devices restart the stream). The installed PWA is already portrait-only via
 * the manifest; this adds the runtime lock for the in-browser case.
 *
 * `screen.orientation.lock()` is only permitted in some browsers (and often
 * only in fullscreen) — it's best-effort by design: if the platform refuses,
 * we simply don't rotate anything and the UI still works.
 */
export function usePortraitLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return
    const orientation = (
      window.screen as Screen & {
        orientation?: {
          lock?: (o: string) => Promise<void>
          unlock?: () => void
        }
      }
    ).orientation
    if (!orientation?.lock) return
    let locked = false
    // Promise rejection is expected on unsupported/non-fullscreen platforms.
    orientation
      .lock("portrait")
      .then(() => {
        locked = true
      })
      .catch(() => {
        /* platform refused — nothing to undo */
      })
    return () => {
      if (locked) {
        try {
          orientation.unlock?.()
        } catch {
          /* ignore */
        }
      }
    }
  }, [active])
}
