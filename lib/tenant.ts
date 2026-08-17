/**
 * Which store is this request for? — derived from the HOST, not the build.
 *
 * One deployment serves every store. `alrahmah.clinixa.cloud` and
 * `alhiah.clinixa.cloud` are the same running app; only the Host header
 * differs. That replaces the old model of one branch + one Docker image +
 * one set of keys per store, where adding a tenant meant a build and every
 * new env var had to be remembered in three places.
 *
 * Pure and dependency-free on purpose: it runs in Server Components (via the
 * Host header), in the browser (via location.hostname), and in unit tests.
 */

/** `pharma.` is the marketing/central site, not a store. */
export const CENTRAL_SUBDOMAINS = ["pharma", "www"] as const

export type Tenant =
  /** The marketing site + central login. */
  | { mode: "central"; slug: "" }
  /** A store's own subdomain, e.g. alrahmah.clinixa.cloud → "alrahmah". */
  | { mode: "store"; slug: string }
  /**
   * A host we don't recognise — a custom domain a store pointed at us.
   * The slug can't be read from the URL, so the backend resolves it from its
   * `host` column. Never guess: guessing wrong shows one store another
   * store's data.
   */
  | { mode: "custom"; slug: "" }

export const CENTRAL: Tenant = { mode: "central", slug: "" }

/**
 * Strip the port, lowercase, drop a trailing dot (`example.com.` is legal).
 * The port is matched as `:<digits>` at the END — splitting on ":" would
 * mangle a bracketed IPv6 host like `[::1]` into `[`.
 */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
}

function isLocal(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
}

/**
 * Resolve a Host header (or `location.hostname`) to a tenant.
 *
 * @param host        e.g. "alhiah.clinixa.cloud", "pharma.clinixa.cloud:3000"
 * @param rootDomain  the domain tenants live under, e.g. "clinixa.cloud"
 * @param devSlug     local dev only — `alrahmah.localhost:3000` also works
 */
export function tenantFromHost(
  host: string | null | undefined,
  rootDomain: string,
  devSlug = "",
): Tenant {
  if (!host) return CENTRAL
  const h = normalizeHost(host)
  const root = normalizeHost(rootDomain)

  // Local dev: `<slug>.localhost` picks a tenant, otherwise fall back to the
  // env var so `pnpm dev` can still target one store.
  if (isLocal(h)) {
    // Match ONLY `<slug>.localhost` / `<slug>.local` — an IP like 127.0.0.1
    // must never be split on the dot and read as a tenant called "127".
    const named = /^([a-z0-9-]+)\.(?:localhost|local)$/.exec(h)
    if (named) return { mode: "store", slug: named[1] }
    return devSlug ? { mode: "store", slug: devSlug } : CENTRAL
  }

  // The bare root domain is the central site.
  if (h === root) return CENTRAL

  if (h.endsWith(`.${root}`)) {
    const sub = h.slice(0, -(root.length + 1))
    // Only a single label is a tenant. `a.b.clinixa.cloud` is not "a".
    if (!sub || sub.includes(".")) return CENTRAL
    if ((CENTRAL_SUBDOMAINS as readonly string[]).includes(sub)) return CENTRAL
    return { mode: "store", slug: sub }
  }

  // Someone's own domain pointed at us — the backend has to tell us who.
  return { mode: "custom", slug: "" }
}

/** The tenant slug for a host, or "" for the central site / unknown domain. */
export function slugFromHost(
  host: string | null | undefined,
  rootDomain: string,
  devSlug = "",
): string {
  return tenantFromHost(host, rootDomain, devSlug).slug
}
