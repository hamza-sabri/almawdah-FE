import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * One account, on one deployment.
 *
 * Every shop is its own deployment with its own database, so the JWT's user id
 * is unique only WITHIN a shop — "user 2" exists in all of them. Convex is a
 * single hosted project whose URL is pasted into every deployment, so an id
 * that is only locally unique put shop A's user 2 and shop B's user 2 on the
 * same cart document, and each watched the other's baskets appear live.
 */

/** A JWT with the given user_id. Signature is never checked client-side. */
function token(userId: number): string {
  const body = btoa(JSON.stringify({ user_id: userId }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
  return `header.${body}.sig`
}

const ORIGINAL = process.env.NEXT_PUBLIC_API_BASE_URL

async function accountIdFor(base: string, userId: number): Promise<string> {
  process.env.NEXT_PUBLIC_API_BASE_URL = base
  vi.resetModules()
  window.localStorage.setItem("alrahmah_access", token(userId))
  const { convexAccountId } = await import("@/lib/convex")
  return convexAccountId()
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL
})

describe("the account id", () => {
  it("separates the same user id on two different shops", async () => {
    const a = await accountIdFor("https://almawdah.store.clinixa.cloud", 2)
    const b = await accountIdFor("https://alzahra.store.clinixa.cloud", 2)
    expect(a).not.toBe(b)
  })

  it("still separates two users on the SAME shop", async () => {
    const a = await accountIdFor("https://almawdah.store.clinixa.cloud", 2)
    const b = await accountIdFor("https://almawdah.store.clinixa.cloud", 3)
    expect(a).not.toBe(b)
  })

  it("is stable for the same user on the same shop", async () => {
    const a = await accountIdFor("https://almawdah.store.clinixa.cloud", 7)
    const b = await accountIdFor("https://almawdah.store.clinixa.cloud", 7)
    expect(a).toBe(b)
  })

  it("carries the backend host, so the id says where it came from", async () => {
    const a = await accountIdFor("https://almawdah.store.clinixa.cloud", 2)
    expect(a).toBe("almawdah.store.clinixa.cloud:2")
  })

  it("is 'anon' with no token — never an id that could match someone", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://almawdah.store.clinixa.cloud"
    vi.resetModules()
    window.localStorage.removeItem("alrahmah_access")
    const { convexAccountId } = await import("@/lib/convex")
    expect(convexAccountId()).toBe("anon")
  })

  it("is 'anon' on a malformed token rather than a partial id", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://almawdah.store.clinixa.cloud"
    vi.resetModules()
    window.localStorage.setItem("alrahmah_access", "not-a-jwt")
    const { convexAccountId } = await import("@/lib/convex")
    expect(convexAccountId()).toBe("anon")
  })
})
