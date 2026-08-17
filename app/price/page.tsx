import type { Metadata } from "next"
import { headers } from "next/headers"

import { DEFAULT_BRAND_NAME, fetchBranding } from "@/lib/branding"
import { fetchSharedProduct } from "@/lib/price.server"
import { currentSlug } from "@/lib/tenant.server"

import PriceClient from "./price-client"

/**
 * The public price page.
 *
 * A thin Server Component wrapper whose only job is the link preview: when a
 * customer shares a product on WhatsApp, the crawler fetches this URL with
 * plain HTTP and reads the meta tags — it never runs the client component
 * below. Per-product previews therefore have to be built here, from the
 * `?barcode=` on the request.
 *
 * Dynamic because both the tenant (Host header) and the product (query string)
 * are per-request. A response cached by URL alone would hand one store's
 * product and branding to another store's link.
 */
export const dynamic = "force-dynamic"

type Search = { barcode?: string | string[] }

function firstBarcode(sp: Search | undefined): string {
  const raw = sp?.barcode
  const v = Array.isArray(raw) ? raw[0] : raw
  return (v ?? "").trim()
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>
}): Promise<Metadata> {
  const [slug, sp, h] = await Promise.all([
    currentSlug(),
    searchParams,
    headers(),
  ])
  const barcode = firstBarcode(sp)
  const branding = await fetchBranding({ slug })
  const store = branding?.name?.trim() || DEFAULT_BRAND_NAME

  // Build the canonical URL from the host that served THIS request, never a
  // reconstructed `<slug>.clinixa.cloud` — a store on its own domain must
  // not have its preview point at a domain its customers don't recognise.
  const host = h.get("host") ?? ""
  const origin = host ? `https://${host}` : ""

  const product = barcode ? await fetchSharedProduct(slug, barcode) : null

  if (!product) {
    // A bare /price open, or a barcode this store doesn't stock.
    return {
      title: `${store} — استعلام الأسعار`,
      description: "امسح باركود المنتج لمعرفة السعر والتوفر.",
      openGraph: {
        title: `${store} — استعلام الأسعار`,
        description: "امسح باركود المنتج لمعرفة السعر والتوفر.",
        url: origin ? `${origin}/price` : undefined,
        type: "website",
      },
    }
  }

  const price = product.price ? `${product.price} ₪` : "اسأل الموظف عن السعر"
  const title = `${product.name} — ${store}`

  return {
    title,
    description: price,
    openGraph: {
      title,
      description: price,
      url: origin
        ? `${origin}/price?barcode=${encodeURIComponent(barcode)}`
        : undefined,
      siteName: store,
      type: "website",
      images: product.image ? [{ url: product.image }] : undefined,
    },
    twitter: {
      card: product.image ? "summary_large_image" : "summary",
      title,
      description: price,
    },
  }
}

export default function PricePage() {
  return <PriceClient />
}
