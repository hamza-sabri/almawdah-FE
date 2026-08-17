import { API_BASE } from "@/api/http"

/** Public, aggregate-only platform stats for the marketing site (no auth). */
export type PublicStats = {
  products: number
  listings: number
  stores: number
  with_images: number
  categories: { name: string; count: number }[]
}

export async function publicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_BASE}/api/v1/public/stats/`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`stats ${res.status}`)
  return (await res.json()) as PublicStats
}
