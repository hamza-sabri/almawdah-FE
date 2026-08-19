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

/**
 * Which backend this browser is talking to.
 *
 * The user id in the JWT is unique inside ONE database — and every shop is a
 * separate deployment with its own database, so "user 2" exists in all of
 * them. Convex, however, is a single hosted project whose URL is pasted into
 * every deployment: keyed on the bare user id, shop A's user 2 and shop B's
 * user 2 write to the SAME cart document and each sees the other's open
 * baskets appear live.
 *
 * The host of the API base is what actually distinguishes one database from
 * another, so it is what makes the id globally unique. Read from the env
 * directly rather than importing API_BASE, to keep this module free of any
 * import cycle with the fetch layer.
 */
function backendNamespace(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  try {
    return new URL(raw).host || "local"
  } catch {
    // Relative or unset base: the origin is the backend.
    return typeof window === "undefined" ? "local" : window.location.host
  }
}

/**
 * Stable per-account id, read from the (signed) JWT — no extra requests.
 *
 * Namespaced by backend (see above) so it identifies ONE account on ONE
 * deployment, which is what every consumer actually means by "account":
 * the Convex cart document, the localStorage key, and the ownership stamp
 * written into the cart blob itself.
 */
export function convexAccountId(): string {
  try {
    const tok = window.localStorage.getItem("alrahmah_access")
    if (!tok) return "anon"
    const b64 = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(b64)) as { user_id?: number; sub?: string }
    const uid = String(payload.user_id ?? payload.sub ?? "")
    if (!uid) return "anon"
    return `${backendNamespace()}:${uid}`
  } catch {
    return "anon"
  }
}
