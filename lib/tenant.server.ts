import "server-only"

import { headers } from "next/headers"

import { ROOT_DOMAIN } from "@/lib/site"
import { CENTRAL, tenantFromHost, type Tenant } from "@/lib/tenant"

/**
 * The tenant for the CURRENT request, from the Host header.
 *
 * Server-only: `next/headers` cannot be imported from a Client Component, so
 * this lives apart from `lib/site.ts` (which both sides import). Any Server
 * Component or route handler that needs to know which store it is rendering
 * for calls this and passes the slug down — never reaches for an env var,
 * because one build now serves every store.
 */
export async function currentTenant(): Promise<Tenant> {
  try {
    const host = (await headers()).get("host")
    return tenantFromHost(host, ROOT_DOMAIN, process.env.NEXT_PUBLIC_PHARMACY_SLUG)
  } catch {
    // `headers()` throws when a page is statically rendered at build time.
    // The central site is the only safe default: it shows no tenant data.
    return CENTRAL
  }
}

/** Slug for the current request, or "" for the central site / unknown host. */
export async function currentSlug(): Promise<string> {
  return (await currentTenant()).slug
}
