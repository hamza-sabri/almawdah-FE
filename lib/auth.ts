"use client"

import { authLoginCreate, authLogoutCreate } from "@/api/generated/auth/auth"
import type { User } from "@/api/generated/model"
import { clearOfflineCaches } from "@/lib/offline/catalog-cache"
import { getPharmacySlug } from "@/lib/site"
import { setTokens, clearTokens, getRefreshToken } from "@/lib/tokens"

export type SessionUser = User & {
  store_slug?: string
  pharmacy_name?: string
  role?: "owner" | "employee"
}

type LoginPayload = {
  access: string
  refresh: string
  user: SessionUser
}

/** Log in with username + password, storing the returned JWT pair. */
export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  // Usernames are unique PER PHARMACY — tenant sites send their slug so the
  // backend pins the lookup to this store. Empty on the central site,
  // where the password disambiguates.
  const slug = getPharmacySlug()
  const body = slug ? { username, password, store: slug } : { username, password }
  const res = await authLoginCreate(body as Parameters<typeof authLoginCreate>[0])
  // The schema declares no response body, but the API returns the tokens + user.
  const payload = (res as unknown as { data: LoginPayload }).data
  if (!payload?.access) {
    throw new Error("لم يتم استلام رمز الدخول من الخادم")
  }
  setTokens(payload.access, payload.refresh)
  // A fresh login must never inherit a previous account's offline catalogue.
  await clearOfflineCaches()
  return payload.user
}

/** Blacklist the refresh token (best effort) and clear the local session. */
export async function logout(): Promise<void> {
  const refresh = getRefreshToken()
  try {
    if (refresh) await authLogoutCreate({ refresh })
  } catch {
    // Ignore network/blacklist errors — we clear locally regardless.
  } finally {
    clearTokens()
    await clearOfflineCaches()
  }
}
