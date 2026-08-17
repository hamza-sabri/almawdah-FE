"use client"

/**
 * Offline mode (sell while the internet is down + auto-sync) is a top-tier
 * capability, gated by the "offline" feature module. The React layer keeps this
 * localStorage flag in sync (see OfflineGate) so non-React code — the sale
 * submit path — can check it synchronously.
 */
const KEY = "pharma_offline_enabled"

export function isOfflineEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setOfflineEnabled(on: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0")
  } catch {
    /* ignore */
  }
}
