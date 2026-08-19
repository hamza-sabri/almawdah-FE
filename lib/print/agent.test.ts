import { describe, it, expect, vi, afterEach } from "vitest"
import { agentStatus, agentPrint } from "@/lib/print/agent"

/**
 * The client for the local print agent.
 *
 * The rule these tests exist to hold: a printer problem must NEVER be able to
 * block a sale. Every failure mode resolves to "not available" so the caller
 * falls back to saving the receipt as a file.
 */
afterEach(() => vi.unstubAllGlobals())

function stub(fn: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn((u: string, i?: RequestInit) => Promise.resolve(fn(u, i))))
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("agent status", () => {
  it("reports the printer when the agent has one", async () => {
    stub(() => json({ ready: true, printer: "RONGTA 80mm", version: "1.0.0" }))
    expect(await agentStatus()).toEqual({
      available: true, printer: "RONGTA 80mm", version: "1.0.0",
    })
  })

  it("distinguishes 'no agent' from 'agent, but no printer'", async () => {
    // The difference decides whether we fall back to the browser dialog or go
    // straight to a file — 'no printer' is a real answer, 'no agent' is not.
    stub(() => json({ ready: false, error: "no default printer is set" }))
    expect(await agentStatus()).toEqual({
      available: false, reason: "no-printer", detail: "no default printer is set",
    })
  })

  it("treats a refused connection as 'no agent', not an error", async () => {
    stub(() => { throw new TypeError("Failed to fetch") })
    expect(await agentStatus()).toEqual({ available: false, reason: "no-agent" })
  })

  it("treats a non-200 as 'no agent' — something else owns that port", async () => {
    stub(() => json({}, 500))
    expect(await agentStatus()).toEqual({ available: false, reason: "no-agent" })
  })

  it("never rejects, whatever the network does", async () => {
    stub(() => { throw new Error("boom") })
    await expect(agentStatus()).resolves.toBeTruthy()
  })

  it("gives up quickly — a cashier has a customer waiting", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, i?: RequestInit) =>
      new Promise((_res, rej) => {
        i?.signal?.addEventListener("abort", () => rej(new Error("aborted")))
      })))
    const t0 = Date.now()
    const r = await agentStatus()
    expect(r).toEqual({ available: false, reason: "no-agent" })
    expect(Date.now() - t0).toBeLessThan(4000)
  }, 10_000)
})

describe("agent print", () => {
  it("posts the payload as JSON to the print endpoint", async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    stub((u, i) => { calls.push([u, i]); return json({ printed: true }) })
    expect(await agentPrint("AAEC", "فاتورة 1")).toEqual({ ok: true })
    expect(calls[0][0]).toBe("http://127.0.0.1:9110/print")
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      data: "AAEC", name: "فاتورة 1", printer: "",
    })
  })

  it("sends the CHOSEN printer, not whatever the OS calls default", async () => {
    // The shop's till defaulted to Microsoft Print to PDF, so every receipt
    // became a silent download instead of paper.
    const calls: Array<[string, RequestInit | undefined]> = []
    stub((u, i) => { calls.push([u, i]); return json({ printed: true }) })
    await agentPrint("AA", "x", "RONGTA 80mm")
    expect(JSON.parse(String(calls[0][1]?.body)).printer).toBe("RONGTA 80mm")
  })

  it("surfaces the agent's reason when the printer refuses", async () => {
    stub(() => json({ error: "the spooler refused the job" }, 503))
    expect(await agentPrint("AA", "x")).toEqual({
      ok: false, detail: "the spooler refused the job",
    })
  })

  it("fails soft when the agent dies mid-print", async () => {
    stub(() => { throw new Error("socket hang up") })
    const r = await agentPrint("AA", "x")
    expect(r.ok).toBe(false)
  })
})
