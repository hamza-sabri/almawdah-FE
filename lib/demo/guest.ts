"use client"

/**
 * Guest demo mode — lets anyone try the app with NO login and NO backend.
 * Entered via `/pos?demo=1`; a session flag keeps it on while the guest
 * navigates. All data is mocked in the browser (see mock-backend.ts) so
 * nothing ever touches the real database.
 */

const KEY = "pharma_guest_demo"

// Read the real access token directly (no import cycle) so demo mode can never
// coexist with a real, authenticated session.
function hasRealToken(): boolean {
  try {
    return Boolean(window.localStorage.getItem("alrahmah_access"))
  } catch {
    return false
  }
}

export function isGuestDemo(): boolean {
  if (typeof window === "undefined") return false
  try {
    // A real logged-in session ALWAYS wins. Demo mode must never shadow the
    // real backend or serve mock data to an authenticated user — a stale
    // `?demo=1` / session flag must not hide real data behind the mock.
    if (hasRealToken()) {
      window.sessionStorage.removeItem(KEY)
      return false
    }
    if (window.sessionStorage.getItem(KEY) === "1") return true
    const p = new URLSearchParams(window.location.search)
    if (p.get("demo") === "1") {
      window.sessionStorage.setItem(KEY, "1")
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function endGuestDemo(): void {
  try {
    window.sessionStorage.removeItem(KEY)
    // Drop any demo cart/catalog cached under the guest account.
    for (const k of Object.keys(window.localStorage)) {
      if (k.includes("demo") || k.includes("guest")) window.localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}
