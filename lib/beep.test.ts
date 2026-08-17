import { describe, it, expect, beforeEach } from "vitest"
import { isMuted, setMuted } from "@/lib/beep"

// Guards the sound fix: the mute state is a single source of truth in
// localStorage (the old bug was two out-of-sync mute flags).
describe("sound mute — single source of truth", () => {
  beforeEach(() => window.localStorage.clear())

  it("defaults to not muted", () => {
    expect(isMuted()).toBe(false)
  })

  it("round-trips true then false", () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })
})
