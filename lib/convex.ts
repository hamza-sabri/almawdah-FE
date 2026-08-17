"use client"

import { ConvexClient } from "convex/browser"
import { anyApi } from "convex/server"

/**
 * Optional realtime layer (Convex). When NEXT_PUBLIC_CONVEX_URL is set the
 * POS carts sync live across devices via a Convex subscription; without it
 * the app silently falls back to the classic sync-on-load behaviour.
 */

let client: ConvexClient | null | undefined

export function getConvex(): ConvexClient | null {
  if (typeof window === "undefined") return null
  if (client !== undefined) return client
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  try {
    client = url ? new ConvexClient(url) : null
  } catch {
    client = null
  }
  return client
}

// `anyApi` keeps this build-safe without convex codegen output.
export const cartsApi = {
  get: anyApi.carts.get,
  put: anyApi.carts.put,
}

/** Stable per-account id, read from the (signed) JWT — no extra requests. */
export function convexAccountId(): string {
  try {
    const tok = window.localStorage.getItem("alrahmah_access")
    if (!tok) return "anon"
    const b64 = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(b64)) as { user_id?: number; sub?: string }
    return String(payload.user_id ?? payload.sub ?? "anon")
  } catch {
    return "anon"
  }
}
