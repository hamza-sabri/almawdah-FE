import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { QtyEditor } from "@/app/(app)/pos/page"

/**
 * THE critical POS question.
 *
 * The quantity field auto-focuses on every add, so when the cashier scans the
 * NEXT item those keystrokes land in a focused number input. Does the barcode
 * get added to the cart — or silently typed in as a quantity of
 * 6,291,234,567,890?
 *
 * The field tells them apart by SPEED. A gun delivers its whole code with
 * <80ms between keys and an Enter at the end; a human cannot. On that Enter
 * the field hands the code to the scan handler and restores whatever it was
 * showing before the burst.
 *
 * NOTE on the harness: vitest.setup.ts polyfills matchMedia to always report
 * `matches: false`, which makes the component's "(pointer: fine)" guard skip
 * focusing — correct for a touch tablet, wrong for the till this test is
 * about. So each test forces a fine pointer.
 */

function finePointer() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

/** Type `code` into `el`, `gapMs` apart, ending with Enter.
 *  `selected` models a field whose contents are highlighted, where the first
 *  keystroke replaces rather than appends. */
function burst(
  el: HTMLInputElement,
  code: string,
  { gapMs = 10, selected = false } = {},
) {
  let t = 1_000_000
  vi.setSystemTime(t)
  code.split("").forEach((c, i) => {
    fireEvent.keyDown(el, { key: c })
    const next = selected && i === 0 ? c : el.value + c
    fireEvent.change(el, { target: { value: next } })
    t += gapMs
    vi.setSystemTime(t)
  })
  fireEvent.keyDown(el, { key: "Enter" })
}

const qty = () => screen.getByLabelText("الكمية") as HTMLInputElement

describe("scanning while the quantity field is focused", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    finePointer()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("a scanned barcode goes to the CART, never into the quantity", () => {
    const onScanBurst = vi.fn()
    const onChange = vi.fn()
    render(
      <QtyEditor value={1} onChange={onChange} focusSignal={1} onScanBurst={onScanBurst} />,
    )
    burst(qty(), "6291234567890", { selected: true })

    expect(onScanBurst).toHaveBeenCalledWith("6291234567890")
    expect(qty().value).toBe("1") // quantity put back
    expect(onChange).not.toHaveBeenCalled()
  })

  it("the field is focused and its contents selected on an add", () => {
    render(<QtyEditor value={1} onChange={vi.fn()} focusSignal={1} />)
    expect(document.activeElement).toBe(qty())
  })

  it("seeds the typed digit and keeps it when a scan follows", () => {
    const onScanBurst = vi.fn()
    render(
      <QtyEditor
        value={1}
        onChange={vi.fn()}
        focusSignal={1}
        seedDigit="6"
        onScanBurst={onScanBurst}
      />,
    )
    expect(qty().value).toBe("6") // seeded, not the old "1"

    // A code that BEGINS with the seeded digit must arrive whole.
    burst(qty(), "291234567890")
    expect(onScanBurst).toHaveBeenCalledWith("6291234567890")
    expect(qty().value).toBe("1") // restored to the pre-burst quantity
  })

  it("a HUMAN typing digits slowly is a quantity, not a scan", () => {
    const onScanBurst = vi.fn()
    const onSubmitSale = vi.fn()
    const onChange = vi.fn()
    render(
      <QtyEditor
        value={1}
        onChange={onChange}
        focusSignal={1}
        onScanBurst={onScanBurst}
        onSubmitSale={onSubmitSale}
      />,
    )
    burst(qty(), "12", { gapMs: 300, selected: true }) // human speed

    expect(onScanBurst).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(12)
    expect(onSubmitSale).toHaveBeenCalledOnce() // Enter completes the sale
  })

  it("a short digit run is a quantity even when typed fast", () => {
    // Below SCAN_MIN_LEN (3) nothing can be a barcode.
    const onScanBurst = vi.fn()
    const onChange = vi.fn()
    render(
      <QtyEditor value={1} onChange={onChange} focusSignal={1} onScanBurst={onScanBurst} />,
    )
    burst(qty(), "12", { selected: true })
    expect(onScanBurst).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(12)
  })

  it("a mistyped letter can never delete the line", () => {
    // parseFloat("abc") is NaN, NaN was treated as 0, and 0 removes the line.
    const onChange = vi.fn()
    render(<QtyEditor value={2} onChange={onChange} focusSignal={1} />)
    const el = qty()
    fireEvent.change(el, { target: { value: "abc" } })
    expect(el.value).toBe("") // the letters never landed
    fireEvent.blur(el)
    // Blank is still "remove the line" — that is deliberate — but the letters
    // themselves contributed nothing.
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it("a half-typed decimal reverts instead of deleting the line", () => {
    const onChange = vi.fn()
    render(<QtyEditor value={2} onChange={onChange} focusSignal={1} />)
    const el = qty()
    fireEvent.change(el, { target: { value: "." } })
    fireEvent.blur(el)
    expect(onChange).not.toHaveBeenCalled() // NOT removed
    expect(el.value).toBe("2") // put back
  })

  it("lets a decimal quantity be typed and committed", () => {
    const onChange = vi.fn()
    render(<QtyEditor value={1} onChange={onChange} focusSignal={1} />)
    const el = qty()
    fireEvent.change(el, { target: { value: "0.5" } })
    fireEvent.blur(el)
    expect(onChange).toHaveBeenCalledWith(0.5)
  })
})
