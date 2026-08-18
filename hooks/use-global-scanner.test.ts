import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

import { useGlobalScanner } from "@/hooks/use-global-scanner"

/**
 * The POS keyboard. A till has a barcode gun and a numpad and no mouse worth
 * reaching for, so these gestures ARE the interface:
 *
 *   +  /  −        nudge the line just added
 *   Shift + numpad+  park the cart and open a new one
 *   a digit         start typing that line's quantity
 *
 * All of it has to stay out of the scanner's way — a gun types its code as a
 * fast burst ending in Enter, and that must still win.
 */

function key(init: Partial<KeyboardEventInit> & { key: string }) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  )
}

describe("POS keyboard gestures", () => {
  let onScan: ReturnType<typeof vi.fn>
  let onEnter: ReturnType<typeof vi.fn>
  let onAdjustQty: ReturnType<typeof vi.fn>
  let onNewCart: ReturnType<typeof vi.fn>
  let onDigit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    onScan = vi.fn()
    onEnter = vi.fn()
    onAdjustQty = vi.fn()
    onNewCart = vi.fn()
    onDigit = vi.fn()
    renderHook(() =>
      useGlobalScanner(onScan, { onEnter, onAdjustQty, onNewCart, onDigit }),
    )
  })
  afterEach(() => vi.useRealTimers())

  it("+ increases the last line by one", () => {
    key({ key: "+" })
    expect(onAdjustQty).toHaveBeenCalledWith(1)
  })

  it("− decreases it by one", () => {
    key({ key: "-" })
    expect(onAdjustQty).toHaveBeenCalledWith(-1)
  })

  it("the numpad plus works too", () => {
    key({ key: "+", code: "NumpadAdd" })
    expect(onAdjustQty).toHaveBeenCalledWith(1)
  })

  it("shift + numpad plus opens a new cart instead", () => {
    key({ key: "+", code: "NumpadAdd", shiftKey: true })
    expect(onNewCart).toHaveBeenCalledOnce()
    expect(onAdjustQty).not.toHaveBeenCalled()
  })

  it("a typed digit is handed over to seed the quantity field", () => {
    key({ key: "3" })
    // Held briefly: at the moment the key lands, a lone "3" is
    // indistinguishable from the first character of a barcode.
    expect(onDigit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(150)
    expect(onDigit).toHaveBeenCalledWith("3")
  })

  it("a scanner burst is still a scan, not a quantity", () => {
    // Fast burst: no idle gap between keys, ending in Enter. The FIRST
    // character must survive — this is the case that broke when the digit was
    // handed over eagerly, and it corrupts the barcode silently.
    for (const c of "6291234567890") key({ key: c })
    key({ key: "Enter" })
    expect(onScan).toHaveBeenCalledWith("6291234567890")
    expect(onDigit).not.toHaveBeenCalled()
  })

  it("a burst that starts with a digit does not leak one to onDigit", () => {
    key({ key: "6" })
    vi.advanceTimersByTime(10) // still inside the scanner gap
    for (const c of "291234567890") key({ key: c })
    key({ key: "Enter" })
    expect(onDigit).not.toHaveBeenCalled()
    expect(onScan).toHaveBeenCalledWith("6291234567890")
  })

  it("a digit shorter than minLength is never mistaken for a barcode", () => {
    // Enter arriving before the handoff fires cancels it: the digit is too
    // short to be a scan, and no field has been focused yet, so this is a
    // no-op rather than a bogus scan. (Once the handoff HAS fired, focus is in
    // the quantity field and Enter belongs to it.)
    key({ key: "3" })
    key({ key: "Enter" })
    expect(onScan).not.toHaveBeenCalled()
    expect(onDigit).not.toHaveBeenCalled()
  })

  it("a bare Enter still completes the sale", () => {
    key({ key: "Enter" })
    expect(onEnter).toHaveBeenCalledOnce()
  })

  it("keeps its hands off a focused field", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    key({ key: "+" })
    key({ key: "5" })
    vi.advanceTimersByTime(150)
    expect(onAdjustQty).not.toHaveBeenCalled()
    expect(onDigit).not.toHaveBeenCalled()
    input.remove()
  })

  it("ignores modified keys so real shortcuts still work", () => {
    key({ key: "+", ctrlKey: true })
    key({ key: "5", metaKey: true })
    vi.advanceTimersByTime(150)
    expect(onAdjustQty).not.toHaveBeenCalled()
    expect(onDigit).not.toHaveBeenCalled()
  })
})
