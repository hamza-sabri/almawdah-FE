import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchBranding } from "@/lib/branding"

describe("fetchBranding", () => {
  const realFetch = global.fetch

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PHARMACY_SLUG = "alrahmah"
    delete process.env.NEXT_PUBLIC_SITE_MODE
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it("parses { name, logo } from the public branding endpoint", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ name: "صيدلية الحياة", logo: "b2://x" }) }) as unknown as typeof fetch
    expect(await fetchBranding()).toEqual({ name: "صيدلية الحياة", logo: "b2://x" })
  })

  it("returns null on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    expect(await fetchBranding()).toBeNull()
  })

  it("returns null when name and logo are both empty (keep the default brand)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ name: "", logo: "" }) }) as unknown as typeof fetch
    expect(await fetchBranding()).toBeNull()
  })
})
