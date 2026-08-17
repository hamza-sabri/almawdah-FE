import { CENTRAL, tenantFromHost, type Tenant } from "@/lib/tenant"

export type SiteMode = "central" | "store"

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "clinixa.cloud"

/**
 * The root layout stamps the resolved slug here, server-side, from the Host
 * header. Everything on the client reads it from the DOM instead of parsing
 * the URL itself, so server render, pre-hydration scripts and React all agree
 * on which store this is. A disagreement would flash one store's
 * branding on another's screen, or worse, ask the API for the wrong tenant.
 *
 * Empty string = the central marketing site.
 */
export const TENANT_ATTR = "data-store"

/**
 * Which store is this? — decided by the HOST, not by the build.
 *
 * One deployment serves every store: `alrahmah.clinixa.cloud` and
 * `alhiah.clinixa.cloud` are the same running app. Client-side we trust the
 * slug the server stamped on <html>; the hostname parse is only a fallback
 * for the rare render that never went through the layout (and it is the same
 * pure function the server used, so the two cannot drift).
 */
export function currentTenant(): Tenant {
  if (typeof document !== "undefined") {
    const stamped = document.documentElement.getAttribute(TENANT_ATTR)
    if (stamped !== null) {
      return stamped ? { mode: "store", slug: stamped } : CENTRAL
    }
    return tenantFromHost(
      window.location.hostname,
      ROOT_DOMAIN,
      process.env.NEXT_PUBLIC_PHARMACY_SLUG,
    )
  }
  // Server components must use lib/tenant.server.ts — they have the Host
  // header. Returning CENTRAL here is the safe default: it shows no tenant.
  return CENTRAL
}

export function getSiteMode(): SiteMode {
  return currentTenant().mode === "store" ? "store" : "central"
}

export function isCentral(): boolean {
  return getSiteMode() === "central"
}

export function getPharmacySlug(): string {
  return currentTenant().slug
}

export function pharmacyHost(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`
}

export function pharmacyPosUrl(
  slug: string,
  tokens: { access: string; refresh: string },
): string {
  const fragment = `hnd=1&at=${encodeURIComponent(tokens.access)}&rt=${encodeURIComponent(tokens.refresh)}`
  return `https://${pharmacyHost(slug)}/pos#${fragment}`
}
