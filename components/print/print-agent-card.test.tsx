import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { PrintAgentCard } from "@/components/print/print-agent-card"

/**
 * The install panel.
 *
 * The person reading it is a shopkeeper, or a freelancer on a remote-desktop
 * session at 11pm. Two things have to be true: the steps shown must match the
 * machine they are sitting at, and the panel must tell them — without being
 * asked — whether it worked.
 */
vi.mock("@/lib/print/agent", () => ({
  agentStatus: vi.fn(),
}))
import { agentStatus } from "@/lib/print/agent"

const mocked = vi.mocked(agentStatus)

function ua(value: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mocked.mockReset()
})
afterEach(() => vi.useRealTimers())

describe("print agent card", () => {
  it("says plainly when it is connected, and names the printer", async () => {
    mocked.mockResolvedValue({ available: true, printer: "RONGTA 80mm", version: "1" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/متصل/)).toBeTruthy()
    expect(screen.getByText(/RONGTA 80mm/)).toBeTruthy()
  })

  it("hides the install steps once connected — they are only noise then", async () => {
    mocked.mockResolvedValue({ available: true, printer: "P", version: "1" })
    render(<PrintAgentCard />)
    await screen.findByText(/متصل/)
    expect(screen.queryByText(/تنزيل برنامج الطباعة/)).toBeNull()
  })

  it("separates 'not installed' from 'installed but no printer'", async () => {
    // These need different actions from the person reading, so they must not
    // share a message.
    mocked.mockResolvedValue({ available: false, reason: "no-printer" })
    const { unmount } = render(<PrintAgentCard />)
    expect(await screen.findByText(/لا توجد طابعة افتراضية/)).toBeTruthy()
    unmount()

    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/غير مثبّت/)).toBeTruthy()
  })

  it("shows the Windows steps on Windows", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/Windows protected your PC/)).toBeTruthy()
    expect(screen.queryByText(/Open Anyway/)).toBeNull()
  })

  it("shows the macOS steps on a Mac, including the Open Anyway path", async () => {
    // Control-click no longer bypasses Gatekeeper on current macOS; Privacy &
    // Security → Open Anyway is the only route, so it has to be spelled out.
    ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    // Mentioned in the step and again in the warning about step order, so
    // "at least one" is the assertion — not "exactly one".
    expect((await screen.findAllByText(/Open Anyway/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Windows protected your PC/)).toBeNull()
  })

  it("offers a zip on macOS — a bare binary loses its executable bit", async () => {
    ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    const link = (await screen.findByText(/تنزيل برنامج الطباعة/))
      .closest("a") as HTMLAnchorElement
    expect(link.getAttribute("href")).toMatch(/\.zip$/)
  })

  it("lets the person pick another machine's file", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    fireEvent.click(await screen.findByText(/Apple Silicon/))
    const link = screen.getByText(/تنزيل برنامج الطباعة/).closest("a")!
    expect(link.getAttribute("href")).toContain("mac-arm64")
  })

  it("turns green on its own, without anyone pressing anything", async () => {
    // The person is at the till double-clicking a file; they should not have to
    // come back and press a button to find out it worked.
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    await screen.findByText(/غير مثبّت/)
    mocked.mockResolvedValue({ available: true, printer: "RONGTA", version: "1" })
    await vi.advanceTimersByTimeAsync(2500)
    await waitFor(() => expect(screen.getByText(/متصل/)).toBeTruthy())
  })

  it("stops polling once unmounted", async () => {
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    const { unmount } = render(<PrintAgentCard />)
    await screen.findByText(/غير مثبّت/)
    unmount()
    const before = mocked.mock.calls.length
    await vi.advanceTimersByTimeAsync(6000)
    expect(mocked.mock.calls.length).toBe(before)
  })

  it("offers the quarantine rescue on macOS only", async () => {
    // The .app is ad-hoc signed, so "damaged" should not appear — but if a
    // macOS build still refuses it, the only fix is a terminal command, and
    // the person needs it in front of them rather than in a chat log.
    ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    const { unmount } = render(<PrintAgentCard />)
    expect(await screen.findByText(/is damaged/)).toBeTruthy()
    expect(screen.getByText(/xattr -dr com.apple.quarantine/)).toBeTruthy()
    unmount()

    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    render(<PrintAgentCard />)
    await screen.findByText(/Windows protected your PC/)
    expect(screen.queryByText(/xattr/)).toBeNull()
  })
})

/**
 * The card is the whole manual. Anything a person has to be told out of band —
 * in a chat message, on a phone call — is a step that does not happen at 11pm
 * in a shop.
 */
describe("the manual is complete", () => {
  it("covers Windows end to end: default printer → SmartScreen → test slip", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/Set as default/)).toBeTruthy()
    expect(screen.getByText(/Windows protected your PC/)).toBeTruthy()
    expect(screen.getByText(/Run anyway/)).toBeTruthy()
    expect(screen.getAllByText(/طباعة ورقة اختبار/).length).toBeGreaterThan(0)
  })

  it("covers macOS end to end, in the order the OS forces", async () => {
    ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/Default printer/)).toBeTruthy()
    expect(screen.getByText(/Apple cannot check it/)).toBeTruthy()
    expect(screen.getAllByText(/Open Anyway/).length).toBeGreaterThan(0)
  })

  it("tells the person what to do when the status stays red", async () => {
    // The most likely stall: Chrome blocked the local-network request, which
    // looks exactly like "not installed".
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/بقي أحمر/)).toBeTruthy()
    expect(screen.getByText(/127.0.0.1:9110/)).toBeTruthy()
  })

  it("says how to uninstall — a thing that cannot be left to a phone call", async () => {
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/كيف أوقفه أو أحذفه/)).toBeTruthy()
  })

  it("frames 'installed but no printer' as progress, not failure", async () => {
    // It is the half that carries the risk: install and connection both work.
    mocked.mockResolvedValue({ available: false, reason: "no-printer" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/مثبّت ويعمل/)).toBeTruthy()
    expect(screen.getByText(/التثبيت والاتصال بالتطبيق نجحا/)).toBeTruthy()
  })

  it("offers the test slip only once there is something to print to", async () => {
    mocked.mockResolvedValue({ available: false, reason: "no-printer" })
    const { unmount } = render(<PrintAgentCard />)
    await screen.findByText(/مثبّت ويعمل/)
    expect(screen.queryByRole("button", { name: /طباعة ورقة اختبار/ })).toBeNull()
    unmount()

    mocked.mockResolvedValue({ available: true, printer: "RONGTA", version: "1" })
    render(<PrintAgentCard />)
    expect(await screen.findByRole("button", { name: /طباعة ورقة اختبار/ })).toBeTruthy()
  })

  it("promises no driver install, because that is the owner's real fear", async () => {
    mocked.mockResolvedValue({ available: false, reason: "no-agent" })
    render(<PrintAgentCard />)
    expect(await screen.findByText(/لا يثبّت أي تعريف/)).toBeTruthy()
  })
})
