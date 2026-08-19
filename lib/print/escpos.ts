"use client"

/**
 * ESC/POS: turning a receipt into bytes a thermal printer accepts.
 *
 * We send a monochrome RASTER, not text. Sending text would mean choosing an
 * Arabic code page, hoping this particular Rongta has it, and doing the letter
 * shaping ourselves — three ways to print gibberish in a language the shopkeeper
 * reads and we would not notice. A bitmap is something the browser already
 * draws perfectly and every ESC/POS printer can print.
 *
 * The bytes go to the local print agent (127.0.0.1:9110), which hands them to
 * the OS spooler with the RAW datatype. Nothing here talks to hardware.
 */

/** Printable dots across, by roll width. 203 dpi = 8 dots/mm. */
export const DOTS: Record<"58" | "80", number> = {
  // 48mm and 72mm of ink on 58mm and 80mm paper — the standard printable
  // widths, and both are multiples of 8 (a raster row is whole bytes).
  "58": 384,
  "80": 576,
}

const ESC = 0x1b
const GS = 0x1d

/**
 * A tall raster is sent in horizontal bands. Cheap printers have a small line
 * buffer and answer one enormous GS v 0 by printing garbage or nothing; 128
 * rows is the size every printer in this class copes with.
 */
const BAND_ROWS = 128

/**
 * Pack one row-band of a canvas into 1-bit-per-pixel rows, MSB first.
 * A pixel is black when it is dark AND opaque — anything the browser drew as
 * transparent is paper, not ink.
 */
function packBand(
  px: Uint8ClampedArray,
  width: number,
  fromRow: number,
  rows: number,
  threshold: number,
): Uint8Array {
  const bytesPerRow = width >> 3
  const out = new Uint8Array(bytesPerRow * rows)
  for (let y = 0; y < rows; y++) {
    const srcRow = (fromRow + y) * width
    for (let x = 0; x < width; x++) {
      const i = (srcRow + x) * 4
      const alpha = px[i + 3]
      // Luma, not a plain average: the eye (and the printer) weight green most.
      const luma = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
      if (alpha > 128 && luma < threshold) {
        out[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return out
}

export type EscPosOptions = {
  /** 0..255. Below this a pixel is ink. */
  threshold?: number
  /** Blank dot-rows fed before the cut, so the tear-off is below the text. */
  feed?: number
  /** Ask the printer to cut. Harmless on printers with no cutter. */
  cut?: boolean
}

/**
 * Canvas → ESC/POS bytes.
 *
 * `width` must be a multiple of 8 and must match the printer's printable
 * width, or the image comes out stretched, cropped, or diagonally sheared —
 * the classic symptom of a raster whose row length disagrees with the head.
 */
export function canvasToEscPos(
  image: { data: Uint8ClampedArray; width: number; height: number },
  opts: EscPosOptions = {},
): Uint8Array {
  const { threshold = 160, feed = 4, cut = true } = opts
  const { width, height } = image
  if (width % 8 !== 0) {
    throw new Error(`raster width ${width} is not a multiple of 8`)
  }
  const bytesPerRow = width >> 3
  const chunks: number[] = []

  // ESC @ — reset. A previous job may have left the printer in double-height,
  // inverted, or an odd code page; every receipt starts from a known state.
  chunks.push(ESC, 0x40)

  for (let row = 0; row < height; row += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - row)
    const band = packBand(image.data, width, row, rows, threshold)
    // GS v 0 m xL xH yL yH — m=0 is normal density.
    chunks.push(
      GS, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    )
    for (let i = 0; i < band.length; i++) chunks.push(band[i])
  }

  if (feed > 0) chunks.push(ESC, 0x64, Math.min(feed, 255)) // ESC d n — feed n lines
  // GS V 66 0 — partial cut after feeding. Printers without a cutter ignore it.
  if (cut) chunks.push(GS, 0x56, 0x42, 0x00)

  return Uint8Array.from(chunks)
}

/** Bytes → base64, for the JSON the agent accepts. */
export function toBase64(bytes: Uint8Array): string {
  let s = ""
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on a
  // full-page raster (~40k bytes) and throws.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}
