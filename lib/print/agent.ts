"use client"

/**
 * Talking to the local print agent.
 *
 * The agent is a small program on the till (mawadda-agent/) that listens on
 * loopback and hands bytes to the OS spooler. It exists because a web page
 * cannot print silently — `window.print()` always opens the OS dialog, and the
 * only browser-side escape is a Chrome launch flag on a desktop shortcut that
 * a cashier can lose and a Chrome update can outlive.
 *
 * Everything here fails soft. No agent, agent stopped, no printer attached —
 * all of it resolves to "not available", and the caller saves the receipt as a
 * file instead. A shop must never be unable to complete a sale because a
 * printer is unhappy.
 */

const BASE = "http://127.0.0.1:9110"
/* The till is on the same machine; anything slower than this is a hang, and a
   cashier is waiting with a customer in front of her. */
const STATUS_TIMEOUT = 1200
const PRINT_TIMEOUT = 15_000

export type AgentStatus =
  | { available: true; printer: string; version: string }
  | { available: false; reason: "no-agent" | "no-printer"; detail?: string }

async function call(path: string, init: RequestInit, timeout: number) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    return await fetch(BASE + path, { ...init, signal: ctl.signal, mode: "cors" })
  } finally {
    clearTimeout(t)
  }
}

/**
 * Is there an agent, and does it have a printer?
 *
 * This is the honest answer to "is a printer connected" that the browser
 * cannot get on its own — and the reason "لا توجد طابعة، نزّلنا الفاتورة" can
 * be a fact rather than a guess.
 */
export async function agentStatus(): Promise<AgentStatus> {
  try {
    const res = await call("/status", { method: "GET" }, STATUS_TIMEOUT)
    if (!res.ok) return { available: false, reason: "no-agent" }
    const d = (await res.json()) as {
      ready?: boolean
      printer?: string
      version?: string
      error?: string
    }
    if (!d.ready) {
      return { available: false, reason: "no-printer", detail: d.error }
    }
    return {
      available: true,
      printer: d.printer ?? "",
      version: d.version ?? "",
    }
  } catch {
    // Connection refused, blocked, timed out — from here they are the same
    // thing: no agent.
    return { available: false, reason: "no-agent" }
  }
}

/**
 * Every printer the machine has, and which one the OS considers default.
 *
 * The default is NOT good enough to rely on: the shop's till had Microsoft
 * Print to PDF as its Windows default, so every receipt became a silent PDF
 * download and nothing reached the thermal printer. The cashier's machine is
 * not ours to reconfigure, so the app has to let someone point at the right
 * device.
 */
export async function agentPrinters(): Promise<{
  printers: string[]
  default: string
}> {
  try {
    const res = await call("/printers", { method: "GET" }, STATUS_TIMEOUT)
    if (!res.ok) return { printers: [], default: "" }
    const d = (await res.json()) as { printers?: string[]; default?: string }
    return { printers: d.printers ?? [], default: d.default ?? "" }
  } catch {
    return { printers: [], default: "" }
  }
}

/** ESC/POS for a short self-test slip: legible without a scanner, and short
 *  enough not to waste a metre of roll. */
export function testSlipEscPos(): Uint8Array {
  const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
  return Uint8Array.from([
    0x1b, 0x40,             // ESC @   reset
    0x1b, 0x61, 0x01,       // ESC a 1 centre
    0x1d, 0x21, 0x11,       // GS ! 17 double width + height
    ...enc("TEST OK\n"),
    0x1d, 0x21, 0x00,       // back to normal
    ...enc("Mawadda POS\n"),
    ...enc("printer connected\n"),
    0x1b, 0x64, 0x04,       // feed
    0x1d, 0x56, 0x42, 0x00, // partial cut
  ])
}

/** Send ESC/POS bytes. Resolves true only when the agent says it printed. */
export async function agentPrint(
  base64: string,
  name: string,
  /** Empty = the OS default, which is often the wrong device. */
  printer = "",
): Promise<{ ok: true } | { ok: false; detail?: string }> {
  try {
    const res = await call(
      "/print",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, name, printer }),
      },
      PRINT_TIMEOUT,
    )
    if (res.ok) return { ok: true }
    const d = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, detail: d.error }
  } catch (e) {
    return { ok: false, detail: (e as Error)?.message }
  }
}
