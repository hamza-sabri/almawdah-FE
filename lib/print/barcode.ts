/**
 * Dependency-free Code 128 barcode → SVG.
 *
 * We intentionally hand-roll this (instead of pulling in JsBarcode) so the
 * label/receipt printing stays self-contained: no new npm dependency, no
 * lockfile change, and it renders identically in the print iframe with fonts
 * disabled. Auto-switches between subsets B (ASCII) and C (dense numeric) so a
 * 13-digit EAN scans back to the exact same digits it was printed from.
 *
 * A barcode we generate is a *re-encoding* of the stored code string, not the
 * original box symbology — but it scans to the identical value, which is all
 * the POS and the public price page care about.
 */

// Code 128 bar/space width patterns, values 0..106 (106 = stop).
// Each entry is the run-length of bar,space,bar,space… starting with a bar.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
]

const START_B = 104
const START_C = 105
const STOP = 106

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9"
}

function digitRun(data: string, from: number): number {
  let n = 0
  while (from + n < data.length && isDigit(data[from + n])) n++
  return n
}

/** Encode a string into Code 128 code values (incl. start, checksum, stop). */
function encode(data: string): number[] | null {
  // Code B covers ASCII 32..126; anything outside can't be a real barcode.
  for (const ch of data) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) return null
  }
  if (data.length === 0) return null

  const codes: number[] = []
  let mode: "B" | "C"
  const lead = digitRun(data, 0)
  if (lead === data.length && data.length % 2 === 0) mode = "C"
  else if (lead >= 4) mode = "C"
  else mode = "B"
  codes.push(mode === "C" ? START_C : START_B)

  let pos = 0
  while (pos < data.length) {
    if (mode === "C") {
      if (pos + 1 < data.length && isDigit(data[pos]) && isDigit(data[pos + 1])) {
        codes.push(Number.parseInt(data.slice(pos, pos + 2), 10))
        pos += 2
      } else {
        codes.push(100) // switch to B
        mode = "B"
      }
    } else {
      const run = digitRun(data, pos)
      if (run >= 6 || (run >= 4 && run % 2 === 0) || (run === data.length - pos && run >= 4)) {
        if (run % 2 === 1) {
          codes.push(data.charCodeAt(pos) - 32)
          pos += 1
        }
        codes.push(99) // switch to C
        mode = "C"
      } else {
        codes.push(data.charCodeAt(pos) - 32)
        pos += 1
      }
    }
  }

  let sum = codes[0]
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i
  codes.push(sum % 103)
  codes.push(STOP)
  return codes
}

export type BarcodeSvgOptions = {
  /** Module (narrowest bar) width in px. */
  moduleWidth?: number
  /** Bar height in px. */
  height?: number
  /** Quiet-zone width in modules on each side. */
  quietZone?: number
  /** Bar colour. */
  color?: string
}

/**
 * Render `data` as a Code 128 barcode `<svg>` string, or `null` if the value
 * can't be encoded (non-ASCII / empty). Caller decides the text caption.
 */
export function barcodeSvg(
  data: string,
  opts: BarcodeSvgOptions = {},
): string | null {
  const { moduleWidth = 2, height = 56, quietZone = 10, color = "#000" } = opts
  const codes = encode(data)
  if (!codes) return null

  const rects: string[] = []
  let x = quietZone
  for (const code of codes) {
    const pattern = PATTERNS[code]
    for (let i = 0; i < pattern.length; i++) {
      const w = Number.parseInt(pattern[i], 10)
      if (i % 2 === 0) {
        // bar
        rects.push(
          `<rect x="${x * moduleWidth}" y="0" width="${w * moduleWidth}" height="${height}" fill="${color}"/>`,
        )
      }
      x += w
    }
  }
  const totalModules = x + quietZone
  const width = totalModules * moduleWidth
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" role="img" aria-label="${data}">` +
    rects.join("") +
    `</svg>`
  )
}

/**
 * The bar/space runs of `data`, in modules, starting with a BAR.
 *
 * Same symbol as `barcodeSvg`, without committing to SVG — the thermal-printer
 * path draws it onto a canvas in printer dots, where a module has to land on a
 * whole number of dots or the scanner reads a different number than the one
 * printed underneath it.
 */
export function barcodeModules(data: string): number[] | null {
  const codes = encode(data)
  if (!codes) return null
  const runs: number[] = []
  for (const code of codes) {
    for (const ch of PATTERNS[code]) runs.push(Number.parseInt(ch, 10))
  }
  return runs
}

/** True when a value can be turned into a scannable Code 128 symbol. */
export function canEncodeBarcode(data: string | null | undefined): boolean {
  if (!data) return false
  return encode(String(data)) !== null
}
