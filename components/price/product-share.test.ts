import { describe, expect, it } from "vitest"

import { buildShareUrl, productQrSrc } from "@/components/price/product-share"

describe("buildShareUrl", () => {
  it("points at the origin it was opened from", () => {
    expect(buildShareUrl("6291041500213", "https://alhiah.clinixa.cloud")).toBe(
      "https://alhiah.clinixa.cloud/price?barcode=6291041500213",
    )
  })

  it("works for a store on its own custom domain", () => {
    expect(buildShareUrl("123456", "https://saydaliyat-x.ps")).toBe(
      "https://saydaliyat-x.ps/price?barcode=123456",
    )
  })

  it("never carries a store slug", () => {
    // The tenant travels in the hostname, which the sharer can't forge. A slug
    // in the query string could be edited to point the link at another
    // store's data — this test exists so nobody adds one back "for
    // convenience".
    const url = buildShareUrl("6291041500213", "https://alhiah.clinixa.cloud")
    expect(url).not.toContain("store=")
    expect(url).not.toContain("slug=")
  })

  it("tolerates a trailing slash on the origin", () => {
    expect(buildShareUrl("99", "https://x.clinixa.cloud/")).toBe(
      "https://x.clinixa.cloud/price?barcode=99",
    )
  })

  it("escapes the barcode so it cannot break out of the query string", () => {
    const url = buildShareUrl("12&x=1 y", "https://x.clinixa.cloud")
    expect(url).toBe("https://x.clinixa.cloud/price?barcode=12%26x%3D1%20y")
    // one parameter, not two
    expect(new URL(url).searchParams.get("barcode")).toBe("12&x=1 y")
  })
})

describe("productQrSrc", () => {
  it("asks the backend for this store's QR of this barcode", () => {
    const src = productQrSrc("6291041500213", "alhiah")
    expect(src).toContain("/api/v1/public/product-qr/")
    expect(src).toContain("store=alhiah")
    expect(src).toContain("barcode=6291041500213")
  })

  it("encodes both parameters", () => {
    const src = productQrSrc("a b&c", "some slug")
    const qs = new URL(src, "https://example.test").searchParams
    expect(qs.get("barcode")).toBe("a b&c")
    expect(qs.get("store")).toBe("some slug")
  })
})
