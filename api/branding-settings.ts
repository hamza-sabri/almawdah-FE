"use client"

import { customFetch } from "@/api/http"

/** Owner-only store branding update (logo + name). Multipart, so we build a
 *  FormData and let customFetch strip Content-Type for the boundary. */

export type BrandingUpdate = { name: string; logo: string }

export async function updateBranding(fd: FormData): Promise<BrandingUpdate> {
  const res = await customFetch<{ status: number; data: BrandingUpdate }>(
    "/api/v1/store/branding/",
    { method: "PATCH", body: fd },
  )
  return res.data
}
