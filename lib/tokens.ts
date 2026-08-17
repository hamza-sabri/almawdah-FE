"use client"

const ACCESS_KEY = "alrahmah_access"
const REFRESH_KEY = "alrahmah_refresh"

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh?: string | null): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACCESS_KEY, access)
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACCESS_KEY)
  window.localStorage.removeItem(REFRESH_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}
