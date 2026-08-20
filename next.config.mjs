import path from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A fresh build id on every deploy. The service worker versions its caches by
  // it and deletes the previous version's caches, so users never get a stale
  // bundle after a deploy. (A rebuild of the same commit still bumps it — that's
  // the "fresh start every deploy" behaviour we want.)
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString(),
  },
  /**
   * Local development against a REMOTE backend, without touching its CORS
   * config.
   *
   * Production CORS only allows https://*.clinixa.cloud, so a dev server on
   * http://localhost:3000 is refused by the browser on every request. Rather
   * than widen production's origin list (and restart the API while the shop is
   * trading), proxy through Next: the browser only ever talks to
   * localhost:3000, and the Next server forwards to the real API. Same origin,
   * so CORS never enters into it.
   *
   *   DEV_API_PROXY=https://almawdah-api.clinixa.cloud npm run dev
   *
   * No-op when the variable is unset, so production builds are unaffected.
   */
  /**
   * Django's URLs all END IN A SLASH (APPEND_SLASH). Next, by default,
   * 308-redirects "/api/v1/auth/login/" to "/api/v1/auth/login" BEFORE the
   * rewrite below can run — so every proxied call arrives at a path Django
   * does not serve, and the browser shows a redirect followed by a 403 with
   * no obvious cause. Verified: without this, POST /api/v1/auth/login/
   * returns 308 to the de-slashed path.
   *
   * Harmless in production, where nothing is proxied.
   */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const target = process.env.DEV_API_PROXY
    if (!target) return []
    // The trailing slash must be put back EXPLICITLY. Django's URLs all end
    // in one (APPEND_SLASH), and Next normalises it away on the rewrite
    // destination even with skipTrailingSlashRedirect — verified against an
    // echo server: the backend received "/api/v1/auth/login", not
    // "/api/v1/auth/login/". Query strings are appended by Next afterwards,
    // so "?page=1" still arrives intact.
    return [{ source: "/api/:path*", destination: `${target}/api/:path*/` }]
  },
  // Produce a self-contained server bundle for a small Docker runtime image.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Pin the workspace root so stray lockfiles elsewhere don't confuse Turbopack.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // The products page was rebranded to "inventory" — keep old links,
  // bookmarks and any saved shortcuts working.
  async redirects() {
    return [
      { source: "/products", destination: "/inventory", permanent: false },
      {
        source: "/products/:path*",
        destination: "/inventory/:path*",
        permanent: false,
      },
    ]
  },
}

// Sentry wrapper: uploads source maps at build time so stack traces point at
// real code instead of minified bundles. Only uploads when SENTRY_AUTH_TOKEN is
// present, so local builds and CI without the secret are unaffected.
export default withSentryConfig(nextConfig, {
  // Which Sentry project the source maps upload to. Hardcoding it meant this
  // build shipped its maps to the PHARMACY's project. Env-driven, with this
  // deployment's own project as the default.
  // No default: a hardcoded org uploads THIS deployment's source maps to
  // whatever account happens to be named here. Env or nothing.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || "almawdah-frontend",
  // Quiet build logs; set SENTRY_AUTH_TOKEN in the deploy env to enable upload.
  silent: true,
  widenClientFileUpload: true,
  // Route Sentry's browser requests through our own domain so ad-blockers
  // don't silently swallow error reports.
  tunnelRoute: "/monitoring",
  disableLogger: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
})
