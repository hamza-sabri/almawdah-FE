import "server-only"

/**
 * Server-side product lookup, used ONLY to build link previews.
 *
 * When a customer shares a product on WhatsApp, the crawler fetches the URL
 * with plain HTTP and reads the <meta> tags. It does not run JavaScript, so
 * per-product previews cannot come from the client — they have to be rendered
 * on the server from the `?barcode=` in the request.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.clinixa.cloud"

/** Only what a preview needs. Deliberately NOT the whole API response — see
 *  the note in `fetchSharedProduct`. */
export type SharedProduct = {
  name: string
  price: string | null
  image: string | null
}

/**
 * Fetch a product for a link preview, or null.
 *
 * Returns a hand-built object rather than spreading the API response: if the
 * public payload ever grows a field, it must not silently end up in an Open
 * Graph tag that anyone on WhatsApp can read.
 */
export async function fetchSharedProduct(
  slug: string,
  barcode: string,
): Promise<SharedProduct | null> {
  if (!slug || !barcode) return null
  const q = new URLSearchParams({ store: slug, barcode })
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/public/price-check/?${q.toString()}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      found?: boolean
      name?: string
      price?: string | null
      image?: string
    }
    if (!data?.found || !data.name) return null
    return {
      name: String(data.name),
      price: data.price ?? null,
      image: data.image ?? null,
    }
  } catch {
    return null
  }
}
