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
  org: process.env.SENTRY_ORG || "broken-dudes",
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
