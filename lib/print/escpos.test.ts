import { describe, it, expect } from "vitest"
import { canvasToEscPos, toBase64, DOTS } from "@/lib/print/escpos"

/**
 * The bytes the thermal printer actually receives.
 *
 * These are asserted directly because a wrong header here is invisible until
 * paper comes out sheared, blank, or endlessly feeding — and by then it is in
 * a shop, not on a desk.
 */
function img(w: number, h: number, paint?: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const ink = paint?.(x, y) ?? false
      data[i] = data[i + 1] = data[i + 2] = ink ? 0 : 255
      data[i + 3] = 255
    }
  return { data, width: w, height: h }
}

describe("ESC/POS raster", () => {
  it("starts with ESC @ so a previous job cannot bleed into this one", () => {
    const b = canvasToEscPos(img(8, 1))
    expect([b[0], b[1]]).toEqual([0x1b, 0x40])
  })

  it("uses GS v 0 with the row length in BYTES, not pixels", () => {
    // 576 dots = 72 bytes per row. Sending 576 here is the classic bug: the
    // printer reads 576 bytes per row, runs off the end of the buffer, and
    // prints a diagonal smear.
    const b = canvasToEscPos(img(576, 1))
    expect([b[2], b[3], b[4]]).toEqual([0x1d, 0x76, 0x30])
    expect(b[6] | (b[7] << 8)).toBe(72)
  })

  it("ends with a cut", () => {
    const b = canvasToEscPos(img(8, 1))
    expect(Array.from(b.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00])
  })

  it("can be told not to cut, for a printer with no cutter", () => {
    const b = canvasToEscPos(img(8, 1), { cut: false })
    expect(Array.from(b.slice(-4))).not.toEqual([0x1d, 0x56, 0x42, 0x00])
  })

  it("refuses a width that is not a multiple of 8", () => {
    // A raster row is whole bytes. 570 dots would silently shear the image.
    expect(() => canvasToEscPos(img(570, 1))).toThrow(/multiple of 8/)
  })

  it("sets the leftmost pixel as the HIGH bit of the first byte", () => {
    const b = canvasToEscPos(img(8, 1, (x) => x === 0), { cut: false, feed: 0 })
    expect(b[10]).toBe(0x80)
  })

  it("sets the rightmost pixel as the LOW bit", () => {
    const b = canvasToEscPos(img(8, 1, (x) => x === 7), { cut: false, feed: 0 })
    expect(b[10]).toBe(0x01)
  })

  it("treats transparent pixels as paper, never as ink", () => {
    // A canvas that was never filled white is transparent black — without the
    // alpha check the whole receipt prints as a solid block.
    const w = 8, h = 1
    const data = new Uint8ClampedArray(w * h * 4) // all zeros: black, alpha 0
    const b = canvasToEscPos({ data, width: w, height: h }, { cut: false, feed: 0 })
    expect(b[10]).toBe(0x00)
  })

  it("splits a tall receipt into bands a cheap printer can swallow", () => {
    // One 400-row GS v 0 overruns the line buffer on printers in this class.
    const b = canvasToEscPos(img(8, 400), { cut: false, feed: 0 })
    let bands = 0
    for (let i = 0; i < b.length - 2; i++)
      if (b[i] === 0x1d && b[i + 1] === 0x76 && b[i + 2] === 0x30) bands++
    expect(bands).toBe(4) // 128 + 128 + 128 + 16
  })

  it("the bands add up to every row, none dropped or repeated", () => {
    const h = 300
    const b = canvasToEscPos(img(8, h), { cut: false, feed: 0 })
    let rows = 0
    for (let i = 0; i < b.length - 8; i++)
      if (b[i] === 0x1d && b[i + 1] === 0x76 && b[i + 2] === 0x30)
        rows += b[i + 6] | (b[i + 7] << 8)
    expect(rows).toBe(h)
  })

  it("knows the printable width of each roll, both byte-aligned", () => {
    expect(DOTS["58"]).toBe(384)
    expect(DOTS["80"]).toBe(576)
    expect(DOTS["58"] % 8).toBe(0)
    expect(DOTS["80"] % 8).toBe(0)
  })

  it("base64s a full-size receipt without blowing the argument limit", () => {
    // String.fromCharCode(...bytes) throws on ~40k arguments, which is exactly
    // the size of a real receipt raster.
    const big = canvasToEscPos(img(576, 800))
    expect(big.length).toBeGreaterThan(40_000)
    expect(() => toBase64(big)).not.toThrow()
    expect(toBase64(big).length).toBeGreaterThan(0)
  })

  it("round-trips through base64 unchanged", () => {
    const b = canvasToEscPos(img(8, 3, (x, y) => (x + y) % 2 === 0))
    const back = Uint8Array.from(atob(toBase64(b)), (c) => c.charCodeAt(0))
    expect(Array.from(back)).toEqual(Array.from(b))
  })
})

import { testSlipEscPos } from "@/lib/print/agent"

/**
 * The self-test slip. It exists so "is the app wired to the printer" can be
 * answered in ten seconds over a remote-desktop session, without ringing up a
 * fake sale that then has to be voided out of the books.
 */
describe("the test slip", () => {
  it("is plain ASCII — no code page to get wrong", () => {
    // Deliberately English: an Arabic test slip would need the raster path,
    // and the point of this slip is to test the SIMPLEST thing that can work.
    const b = testSlipEscPos()
    for (const byte of b) expect(byte).toBeLessThan(0x80)
  })

  it("resets, then cuts, like a real receipt", () => {
    const b = testSlipEscPos()
    expect([b[0], b[1]]).toEqual([0x1b, 0x40])
    expect(Array.from(b.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00])
  })

  it("is short — a failed test must not eat a metre of roll", () => {
    expect(testSlipEscPos().length).toBeLessThan(120)
  })

  it("says TEST OK in letters a person can read across a counter", () => {
    const text = String.fromCharCode(...testSlipEscPos())
    expect(text).toContain("TEST OK")
    // double width + height, so it is legible on a 58mm roll
    expect(Array.from(testSlipEscPos())).toContain(0x11)
  })
})
