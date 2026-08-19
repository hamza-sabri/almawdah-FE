import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { PrintSection } from "@/components/settings/print-section"
import { loadPrintSettings } from "@/lib/print/settings"

/**
 * Printing lives on /settings, not only behind the POS's printer icon.
 *
 * The owner sets his shop up from his own laptop; the till dialog is
 * unreachable from there. Anything a person has to be told where to find is in
 * the wrong place.
 */
vi.mock("@/lib/print/agent", () => ({
  agentStatus: vi.fn(async () => ({ available: false, reason: "no-agent" })),
}))

beforeEach(() => window.localStorage.clear())

describe("the printing section", () => {
  it("carries the install panel, so the driver setup is reachable here", async () => {
    render(<PrintSection />)
    expect(await screen.findByText(/الطباعة المباشرة/)).toBeTruthy()
    expect(screen.getByText(/تنزيل برنامج الطباعة/)).toBeTruthy()
  })

  it("persists the roll width — a wrong one crops the receipt", () => {
    render(<PrintSection />)
    fireEvent.click(screen.getByText("58 مم"))
    expect(loadPrintSettings().paper).toBe("58")
  })

  it("persists 'download instead of printing' for a till with no printer", () => {
    render(<PrintSection />)
    fireEvent.click(screen.getByText(/نزّل الفاتورة/))
    expect(loadPrintSettings().deliver).toBe("download")
  })

  it("saves immediately — there is no Save button to forget", () => {
    const { unmount } = render(<PrintSection />)
    fireEvent.click(screen.getByText("80 مم"))
    unmount()
    render(<PrintSection />)
    expect(loadPrintSettings().paper).toBe("80")
  })
})
