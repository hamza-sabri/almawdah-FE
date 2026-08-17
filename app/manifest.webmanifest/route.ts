import {
  DEFAULT_BRAND_NAME,
  DEFAULT_ICON_192,
  DEFAULT_ICON_512,
  DEFAULT_ICON_MASKABLE,
  brandingIconUrl,
  fetchBranding,
} from "@/lib/branding"
import { currentSlug } from "@/lib/tenant.server"

/**
 * PWA manifest — installable, opens standalone like a native app.
 *
 * WHITE-LABELLED PER TENANT: the installed app is named after the store
 * and carries its logo (rendered to square PNGs by the backend), so "Add to
 * Home Screen" installs the store's own name, not a generic one. Falls back
 * to the Pharma brand when the tenant has no name/logo (or on the central
 * site). A route handler instead of app/manifest.ts because the branding is
 * fetched at request time (ISR, hourly) — not frozen at build.
 */
// Per-request: the manifest differs per store, so it cannot be cached
// across hosts. `currentSlug()` reads the Host header, which forces dynamic
// rendering — exactly what we want. (Caching by URL alone would hand one
// store another store's installed app name and icon.)
export const dynamic = "force-dynamic"

export async function GET() {
  const slug = await currentSlug()
  const branding = await fetchBranding({ slug })
  const name = branding?.name?.trim() || DEFAULT_BRAND_NAME
  const icons = branding?.logo
    ? [
        { src: brandingIconUrl(192, false, slug), sizes: "192x192", type: "image/png" },
        { src: brandingIconUrl(512, false, slug), sizes: "512x512", type: "image/png" },
        {
          src: brandingIconUrl(512, true, slug),
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ]
    : [
        { src: DEFAULT_ICON_192, sizes: "192x192", type: "image/png" },
        { src: DEFAULT_ICON_512, sizes: "512x512", type: "image/png" },
        {
          src: DEFAULT_ICON_MASKABLE,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ]

  return Response.json(
    {
      name,
      short_name: name,
      description: "نظام إدارة المنتجات والزبائن والديون للمتجر",
      id: "/",
      // Installed app opens straight into the POS (login-gated); the marketing
      // site lives at "/" for visitors.
      start_url: "/pos",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      background_color: "#f5f4fb",
      theme_color: "#201f38",
      icons,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // `private` + Vary: Host — the body differs per store, so a shared
        // cache keyed on the URL alone would serve one store the other's
        // installed app name and logo.
        "Cache-Control": "private, max-age=300",
        Vary: "Host",
      },
    },
  )
}
