"use client"

/**
 * Tour demo mode — a SAFE sandbox for the interactive guided tours.
 *
 * The guided tour is opened by a logged-in user, but it must NEVER write to the
 * real database (create a sale, a debt, edit stock…). While a tour runs we set
 * this flag; `customFetch` then routes every API call to the in-browser mock
 * backend (the same one the no-login guest demo uses), so the whole app runs on
 * throwaway local data. Turning it off + a reload wipes that data and brings the
 * real store back — "a demo that clears everything once it's done".
 *
 * It is deliberately separate from the guest-demo flag so it can coexist with a
 * real, authenticated session without touching the user's tokens.
 */

const KEY = "pharma_tour_demo"

export function isTourDemo(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function startTourDemo(): void {
  try {
    window.sessionStorage.setItem(KEY, "1")
  } catch {
    /* ignore */
  }
}

export function endTourDemo(): void {
  try {
    window.sessionStorage.removeItem(KEY)
    // Drop anything the mock backend stashed under demo/guest keys.
    for (const k of Object.keys(window.localStorage)) {
      if (k.includes("demo") || k.includes("guest")) {
        window.localStorage.removeItem(k)
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * A short window right after leaving a tour during which a 401 must NOT log the
 * user out. On exit the app swaps demo data back to real data and refetches; a
 * stray call can 401 with a not-yet-refreshed token, and losing the session over
 * that is the "finished the tour → logged out" bug. `customFetch` checks this.
 */
const EXIT_KEY = "pharma_tour_exit_at"

export function markTourExit(): void {
  try {
    window.sessionStorage.setItem(EXIT_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function inTourExitGrace(windowMs = 15_000): boolean {
  if (typeof window === "undefined") return false
  try {
    const t = Number(window.sessionStorage.getItem(EXIT_KEY)) || 0
    return t > 0 && Date.now() - t < windowMs
  } catch {
    return false
  }
}
