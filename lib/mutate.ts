"use client"

import { customFetch } from "@/api/http"

/** REST collection paths on the backend. */
export const ENDPOINTS = {
  products: "/api/v1/products/",
  customers: "/api/v1/customers/",
  debts: "/api/v1/debts/",
} as const

type Fields = Record<string, unknown>
type Files = Record<string, File | File[] | null | undefined>

/**
 * Create (POST) or update (PATCH) a resource. If any file is present the request
 * is sent as multipart/form-data (so the API can upload it to storage); otherwise
 * a normal JSON body is used. Works around the generated client being JSON-only.
 */
export async function upsert(
  basePath: string,
  id: number | undefined,
  fields: Fields,
  files: Files = {},
) {
  const url = id != null ? `${basePath}${id}/` : basePath
  const method = id != null ? "PATCH" : "POST"
  const hasFile = Object.values(files).some(
    (f) => f instanceof File || (Array.isArray(f) && f.length > 0),
  )

  if (hasFile) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null || v === "") continue
      if (Array.isArray(v)) {
        // Lists (e.g. image_urls) repeat the key so DRF reads them as a list.
        for (const item of v) {
          if (item !== undefined && item !== null && item !== "") fd.append(k, String(item))
        }
      } else if (typeof v === "object") {
        // Objects (e.g. attributes) as JSON so a JSONField can parse them.
        fd.append(k, JSON.stringify(v))
      } else {
        fd.append(k, String(v))
      }
    }
    for (const [k, f] of Object.entries(files)) {
      if (f instanceof File) fd.append(k, f)
      // Multiple files repeat the same key (DRF reads them as a list).
      else if (Array.isArray(f)) for (const one of f) fd.append(k, one)
    }
    return customFetch(url, { method, body: fd })
  }

  const body: Fields = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) body[k] = v
  }
  return customFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function remove(basePath: string, id: number) {
  return customFetch(`${basePath}${id}/`, { method: "DELETE" })
}
