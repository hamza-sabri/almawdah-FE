/**
 * Per-tenant branding — each store's own NAME + LOGO everywhere the app
 * chrome used to say "فارما".
 *
 * Source of truth is the backend's public branding endpoint (name + logo by
 * slug, nothing sensitive), so this works logged-out too (login page, PWA
 * manifest). No slug / central site / missing logo → fall back to the generic
 * Pharma brand.
 *
 * Isomorphic on purpose: these run in Server Components (layout metadata,
 * manifest route — with ISR revalidate) and in the browser (React Query via
 * hooks/use-branding).
 *
 * The tenant is per-REQUEST, not per-build: on the client it comes from the
 * slug the layout stamped on <html>; on the server the caller must pass it in
 * (`await currentSlug()`), because a Server Component has no `document` and
 * one deployment now answers for every store. Defaulting rather than
 * passing it server-side would silently brand every tenant as the central
 * site.
 */
import { getPharmacySlug } from "@/lib/site"

export type Branding = { name: string; logo: string }

export const DEFAULT_BRAND_NAME = "فارما"
export const DEFAULT_ICON_192 = "/icons/icon-192.png"
export const DEFAULT_ICON_512 = "/icons/icon-512.png"
export const DEFAULT_ICON_MASKABLE = "/icons/icon-maskable-512.png"

// Mirrors api/http.ts — kept separate so server code doesn't drag in the
// client-only API layer (tokens/localStorage/demo mocks).
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://alrahmah.store.clinixa.cloud"

/** The public branding JSON URL for a tenant, or null when there isn't one. */
export function brandingUrl(slug = getPharmacySlug()): string | null {
  if (!slug) return null
  return `${API_BASE}/api/v1/public/branding/?store=${encodeURIComponent(slug)}`
}

/** Backend-rendered square PNG of the tenant logo (PWA manifest icons). */
export function brandingIconUrl(
  size: 192 | 512,
  maskable = false,
  slug = getPharmacySlug(),
): string {
  return (
    `${API_BASE}/api/v1/public/branding/icon/?store=${encodeURIComponent(slug)}` +
    `&size=${size}${maskable ? "&maskable=1" : ""}`
  )
}

/**
 * Fetch {name, logo} for this tenant. Null on central site, unknown slug,
 * network failure, or when the tenant has neither a name nor a logo — callers
 * then keep the default Pharma brand.
 */
export async function fetchBranding(
  options: { slug?: string; revalidateSeconds?: number } = {},
): Promise<Branding | null> {
  const { slug, revalidateSeconds = 300 } = options
  const url = brandingUrl(slug ?? getPharmacySlug())
  if (!url) return null
  try {
    // `next.revalidate` = ISR on the server; browsers simply ignore the key.
    const res = await fetch(url, { next: { revalidate: revalidateSeconds } })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<Branding> | null
    const name = typeof data?.name === "string" ? data.name.trim() : ""
    const logo = typeof data?.logo === "string" ? data.logo : ""
    if (!name && !logo) return null
    return { name, logo }
  } catch {
    return null
  }
}
