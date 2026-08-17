import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "@/lib/tokens"
import { isGuestDemo } from "@/lib/demo/guest"
import { isTourDemo, inTourExitGrace } from "@/lib/tour/demo"
import { mockFetch } from "@/lib/demo/mock-backend"
import { isOfflineEnabled } from "@/lib/offline/enabled"
import { canAutoDownload, isManualSyncing } from "@/lib/offline/sync-mode"
import { cacheReadResponse, localReadResponse } from "@/lib/offline/reads"

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://alrahmah.store.clinixa.cloud"

/** Pull a human message out of a DRF error body (detail or field errors). */
function extractErrorMessage(detail: unknown, status: number): string {
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>
    if (typeof d.detail === "string") return d.detail
    for (const key of Object.keys(d)) {
      const v = d[key]
      if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0]
      if (typeof v === "string") return v
    }
  }
  return `HTTP ${status}`
}

function redirectToLogin() {
  if (typeof window === "undefined") return
  if (window.location.pathname !== "/login") {
    const next = encodeURIComponent(
      window.location.pathname + window.location.search,
    )
    window.location.href = `/login?next=${next}`
  }
}

type RefreshResult = "ok" | "rejected" | "offline"

let refreshPromise: Promise<RefreshResult> | null = null

async function tryRefresh(): Promise<RefreshResult> {
  const refresh = getRefreshToken()
  if (!refresh) return "rejected"
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) return "rejected"
      const data = (await res.json()) as { access: string; refresh?: string }
      if (!data?.access) return "rejected"
      setTokens(data.access, data.refresh ?? refresh)
      return "ok"
    } catch {
      return "offline"
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/**
 * orval fetch mutator. Prepends the base URL, attaches the JWT, and on a 401
 * tries to refresh the access token once before retrying / redirecting.
 */
export const customFetch = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  // Guest demo OR an interactive tour: never hit the network — serve everything
  // from the in-browser mock backend so nothing touches the real database.
  if (isGuestDemo() || isTourDemo()) {
    return mockFetch<T>(url, options)
  }

  const method = (options.method || "GET").toUpperCase()
  const isRead = method === "GET"
  // READS fall back to the last cached copy for EVERY tier. Showing yesterday's
  // list beats throwing an error the moment the Wi-Fi blinks — the paid
  // "offline" module is about SELLING offline (queuing writes), not about
  // whether the app survives a dropped connection.
  const offlineReads = isRead
  // The sync-mode valves (Download off / manual-only) remain a paid-tier
  // behaviour, so they're only honoured when the module is enabled.
  const valvesApply = isOfflineEnabled()

  // Serve reads from local data when we're offline OR when the user's sync mode
  // has the Download valve closed (unless a manual "Sync now" is forcing it).
  // Falls through to the network if nothing is cached, so first loads still work.
  if (
    offlineReads &&
    ((typeof navigator !== "undefined" && navigator.onLine === false) ||
      (valvesApply && !canAutoDownload() && !isManualSyncing()))
  ) {
    const local = await localReadResponse<T>(url)
    if (local) return local
  }

  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData

  const buildInit = (): RequestInit => {
    const headers = new Headers(options.headers)
    const token = getAccessToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
    // Let the browser set the multipart boundary for FormData bodies.
    if (isForm) headers.delete("Content-Type")
    return { ...options, headers }
  }

  const target = url.startsWith("http") ? url : API_BASE + url

  let res: Response
  try {
    res = await fetch(target, buildInit())
  } catch (e) {
    // Network died mid-request — fall back to local data for reads.
    if (offlineReads) {
      const local = await localReadResponse<T>(url)
      if (local) return local
    }
    throw e
  }

  if (res.status === 401) {
    const refreshResult = await tryRefresh()
    if (refreshResult === "ok") {
      try {
        res = await fetch(target, buildInit())
      } catch (e) {
        if (offlineReads) {
          const local = await localReadResponse<T>(url)
          if (local) return local
        }
        throw e
      }
    } else if (refreshResult === "offline") {
      if (offlineReads) {
        const local = await localReadResponse<T>(url)
        if (local) return local
      }
      throw new Error("تعذر الاتصال بالخادم — لا يوجد إنترنت")
    }
  }

  if (res.status === 401) {
    // Never destroy a real session because of a demo/tour request that slipped
    // through during teardown (incl. the 15s grace window right after a tour
    // exits) — just fail this call, keep the user logged in.
    if (!isTourDemo() && !isGuestDemo() && !inTourExitGrace()) {
      clearTokens()
      redirectToLogin()
    }
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = { detail: res.statusText }
    }
    const err = new Error(extractErrorMessage(detail, res.status)) as Error & {
      status?: number
      data?: unknown
    }
    err.status = res.status
    err.data = detail
    throw err
  }

  // The orval "fetch" client expects a { status, data, headers } envelope.
  let data: unknown = undefined
  if (res.status !== 204) {
    const text = await res.text()
    data = text ? JSON.parse(text) : undefined
  }
  // Write-through cache for reads so they're available next time we're offline.
  if (offlineReads) void cacheReadResponse(url, data)
  return {
    status: res.status,
    data,
    headers: res.headers,
  } as T
}

export default customFetch
