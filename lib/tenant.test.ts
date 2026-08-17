import { describe, expect, it } from "vitest"

import { CENTRAL, slugFromHost, tenantFromHost } from "@/lib/tenant"

const ROOT = "clinixa.cloud"

describe("tenantFromHost", () => {
  it("maps a store subdomain to its slug", () => {
    expect(tenantFromHost("alrahmah.clinixa.cloud", ROOT)).toEqual({
      mode: "store",
      slug: "alrahmah",
    })
    expect(slugFromHost("alhiah.clinixa.cloud", ROOT)).toBe("alhiah")
    expect(slugFromHost("alzahra.clinixa.cloud", ROOT)).toBe("alzahra")
  })

  it("treats the bare root and the marketing subdomains as central", () => {
    expect(tenantFromHost("clinixa.cloud", ROOT)).toEqual(CENTRAL)
    expect(tenantFromHost("pharma.clinixa.cloud", ROOT)).toEqual(CENTRAL)
    expect(tenantFromHost("www.clinixa.cloud", ROOT)).toEqual(CENTRAL)
  })

  it("ignores port, case and a trailing dot", () => {
    expect(slugFromHost("ALHIAH.Clinixa.Cloud:3000", ROOT)).toBe("alhiah")
    expect(slugFromHost("alhiah.clinixa.cloud.", ROOT)).toBe("alhiah")
  })

  it("never guesses a slug from a domain that isn't ours", () => {
    // A lookalike domain must not be able to impersonate a tenant.
    expect(tenantFromHost("alhiah.clinixa.cloud.evil.com", ROOT).mode).toBe(
      "custom",
    )
    expect(tenantFromHost("alhiah.notclinixa.cloud", ROOT).mode).toBe("custom")
    expect(tenantFromHost("saydaliyat-x.ps", ROOT).mode).toBe("custom")
    // …and a custom domain never carries a slug — the backend resolves it.
    expect(tenantFromHost("saydaliyat-x.ps", ROOT).slug).toBe("")
  })

  it("does not treat a deeper subdomain as a tenant", () => {
    expect(tenantFromHost("a.b.clinixa.cloud", ROOT)).toEqual(CENTRAL)
  })

  it("falls back to central for a missing host", () => {
    expect(tenantFromHost(null, ROOT)).toEqual(CENTRAL)
    expect(tenantFromHost(undefined, ROOT)).toEqual(CENTRAL)
    expect(tenantFromHost("", ROOT)).toEqual(CENTRAL)
  })

  describe("local development", () => {
    it("supports <slug>.localhost", () => {
      expect(slugFromHost("alrahmah.localhost:3000", ROOT)).toBe("alrahmah")
    })

    it("falls back to the dev env slug on plain localhost", () => {
      expect(slugFromHost("localhost:3000", ROOT, "alhiah")).toBe("alhiah")
      expect(tenantFromHost("localhost:3000", ROOT)).toEqual(CENTRAL)
    })

    it("never reads an IP address as a tenant", () => {
      // "127.0.0.1" must not split on the dot into a store called "127",
      // and "[::1]" must not be mangled by the port strip.
      expect(tenantFromHost("127.0.0.1:3000", ROOT)).toEqual(CENTRAL)
      expect(tenantFromHost("[::1]", ROOT)).toEqual(CENTRAL)
    })

    it("treats staging as an ordinary tenant subdomain", () => {
      expect(slugFromHost("staging.clinixa.cloud", ROOT)).toBe("staging")
    })
  })
})
