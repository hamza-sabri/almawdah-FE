"use client"

import { setTokens } from "@/lib/tokens"

export function consumeHandoff(): boolean {
  if (typeof window === "undefined") return false
  const hash = window.location.hash
  if (!hash || !hash.includes("hnd=1")) return false
  const params = new URLSearchParams(hash.slice(1))
  const access = params.get("at")
  const refresh = params.get("rt")
  if (!access) return false
  setTokens(access, refresh)
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  )
  return true
}
