import { describe, it, expect, beforeEach } from "vitest"
import { markTourExit, inTourExitGrace } from "@/lib/tour/demo"

// Guards the guide-flow fix: for a short window after a tour exits, a 401 must
// NOT be treated as a real logout (api/http.ts checks inTourExitGrace()).
describe("tour-exit grace window (guide-logout fix)", () => {
  beforeEach(() => window.sessionStorage.clear())

  it("is false when no tour was exited", () => {
    expect(inTourExitGrace()).toBe(false)
  })

  it("is true right after a tour exits", () => {
    markTourExit()
    expect(inTourExitGrace()).toBe(true)
  })

  it("is false once the window elapses", () => {
    markTourExit()
    expect(inTourExitGrace(0)).toBe(false)
  })
})
