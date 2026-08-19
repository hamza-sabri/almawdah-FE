import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describeDelivery } from "@/lib/print/deliver"

/**
 * Every receipt goes out the same door.
 *
 * Three places printed by calling `printReceipt` directly — the reprint dialog,
 * the sales page, and the settings preview. That skipped the local print agent
 * and opened the browser's print dialog, which is the exact thing the agent
 * exists to avoid. Nothing signalled the drift; the buttons looked fine.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe("nothing bypasses the print agent", () => {
  it("only lib/print/ may call printReceipt directly", () => {
    const offenders = walk("app")
      .concat(walk("components"), walk("hooks"))
      .filter((f) => {
        // Strip comments first — the fix left a note explaining why calling
        // printReceipt() here was wrong, and a note is not a call.
        const code = readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
        return /(?<!\w)printReceipt\s*\(/.test(code)
      })
    expect(offenders).toEqual([])
  })

  it("the reprint paths go through deliverAndToast", () => {
    for (const f of [
      "components/print/print-receipt-dialog.tsx",
      "app/(app)/sales/page.tsx",
      "components/print/print-settings-dialog.tsx",
    ]) {
      expect(readFileSync(f, "utf8")).toContain("deliverAndToast")
    }
  })
})

describe("what a delivery result says", () => {
  it("printing on paper is quiet and short", () => {
    for (const outcome of ["agent", "printed"] as const) {
      const d = describeDelivery({ outcome })
      expect(d.tone).toBe("ok")
      expect(d.description).toContain("طُبعت")
      expect(d.duration).toBeLessThanOrEqual(3500)
    }
  })

  it("a chosen download is a success, not a warning", () => {
    const d = describeDelivery({ outcome: "downloaded" })
    expect(d.tone).toBe("ok")
    expect(d.description).toContain("نُزّلت")
  })

  it("no printer is a warning, and carries the reason when there is one", () => {
    const d = describeDelivery({
      outcome: "unavailable",
      detail: "the spooler refused the job",
    })
    expect(d.tone).toBe("warn")
    expect(d.description).toContain("لا توجد طابعة")
    expect(d.description).toContain("the spooler refused the job")
  })

  it("never holds the screen longer than 7 seconds", () => {
    for (const outcome of ["agent", "printed", "downloaded", "unavailable"] as const)
      expect(describeDelivery({ outcome }).duration).toBeLessThanOrEqual(7000)
  })
})
