"use client"

/**
 * Retail EAN/UPC plus code_128 — our stores' shelf labels are printed by
 * the POS label printer as Code-128 carrying arbitrary digits (they do NOT
 * have a valid EAN checksum). code_39 and itf are deliberately excluded:
 * they let ZXing misread EAN fragments into letters/`*+%` garbage.
 */
export const SCAN_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
]

/** A box in VIDEO-FRAME coordinates (not display px) around a detected code. */
export type CodeBox = { x: number; y: number; w: number; h: number }

export type DetectedCode = { rawValue: string; format?: string; box?: CodeBox }

export type DetectorLike = {
  detect(source: CanvasImageSource): Promise<
    Array<DetectedCode & { boundingBox?: DOMRectReadOnly }>
  >
}

function nativeBox(c: { boundingBox?: DOMRectReadOnly }): CodeBox | undefined {
  const b = c.boundingBox
  return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : undefined
}

/** Map a box from cropped/scaled canvas coordinates back to frame coords. */
function unmapBox(
  box: CodeBox | undefined,
  sx: number,
  sy: number,
  scale: number,
): CodeBox | undefined {
  if (!box) return undefined
  return {
    x: sx + box.x / scale,
    y: sy + box.y / scale,
    w: box.w / scale,
    h: box.h / scale,
  }
}

/**
 * ALWAYS the ZXing-WASM ponyfill — deliberately NOT the platform's native
 * BarcodeDetector. On several Android builds the native detector constructs
 * fine but silently returns nothing for every frame (missing/broken Play
 * Services module), and there is no way to distinguish that from "no barcode
 * in view". Verified in the field: a reference scanner site that force-
 * replaces the native detector with this exact package reads instantly on a
 * phone where the native path found nothing. Same engine on every browser =
 * the consistent behavior we promise stores.
 */
export async function createDetector(): Promise<DetectorLike> {
  const { BarcodeDetector } = await import("barcode-detector/ponyfill")
  return new BarcodeDetector({
    formats: SCAN_FORMATS as never,
  }) as unknown as DetectorLike
}

// upc_e is intentionally NOT here: its check digit belongs to the expanded
// UPC-A form, so the linear checksum below would reject valid UPC-E codes.
const EAN_FAMILY = new Set(["ean_13", "ean_8", "upc_a"])

export function hasValidEanChecksum(code: string): boolean {
  const digits = code.split("").map((d) => Number(d))
  const check = digits.pop() as number
  let sum = 0
  let weight = 3
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10 === check
}

/**
 * CatalogItem barcodes here are ALWAYS digits: real EAN/UPC on manufacturer
 * packaging, or digit-only Code-128 shelf labels printed in-store (which
 * do not carry an EAN checksum — never checksum-gate those).
 */
export function isValidProductBarcode(code: string, format?: string): boolean {
  if (!/^\d{4,20}$/.test(code)) return false
  if (format && EAN_FAMILY.has(format)) return hasValidEanChecksum(code)
  return true
}

export type ScanGate = {
  offer(code: string, now: number, format?: string): string | null
  reset(): void
}

// windowMs is deliberately generous: a hard barcode (small, tilted, glossy)
// may only decode sporadically — two matching reads 1.5s apart still count.
export function createScanGate(confirmations = 2, windowMs = 2000): ScanGate {
  let candidate = ""
  let count = 0
  let firstAt = 0
  return {
    offer(code, now, format) {
      if (!code || !isValidProductBarcode(code, format)) {
        candidate = ""
        count = 0
        return null
      }
      if (code === candidate && now - firstAt <= windowMs) {
        count += 1
      } else {
        candidate = code
        count = 1
        firstAt = now
      }
      if (count >= confirmations) {
        candidate = ""
        count = 0
        return code
      }
      return null
    },
    reset() {
      candidate = ""
      count = 0
      firstAt = 0
    },
  }
}

// Shown in the viewfinder so support can instantly tell which scanner build
// a device is actually running (PWA caches make this genuinely ambiguous).
export const SCANNER_BUILD = "م8"

// ── Second decode engine: ZBar ───────────────────────────────────────────────
// Benchmarked against our real store labels (13-digit Code-128): ZBar decodes
// at ~180px symbol width where ZXing needs ~300px — the difference between
// "reads from a normal aiming distance" and "won't read at all". Vendored as
// a self-contained module (wasm inlined) in /public/vendor and loaded at
// runtime so no bundler config is involved.
const ZBAR_URL = "/vendor/zbar-wasm-0.11.0.mjs"

type ZBarSymbolLike = {
  typeName: string
  decode(): string
  points?: Array<{ x: number; y: number }>
}
type ZBarModuleLike = {
  scanImageData(image: ImageData): Promise<ZBarSymbolLike[]>
}

let zbarPromise: Promise<ZBarModuleLike | null> | null = null

function loadZBar(): Promise<ZBarModuleLike | null> {
  // new Function keeps every bundler (webpack/turbopack) from trying to
  // resolve the URL at build time — this must stay a plain runtime import.
  zbarPromise ??= (
    new Function("u", "return import(u)")(ZBAR_URL) as Promise<ZBarModuleLike>
  ).then(
    (m) => m,
    () => null, // offline before first use, or old cached deploy — just skip
  )
  return zbarPromise
}

const ZBAR_TO_FORMAT: Record<string, string> = {
  ZBAR_CODE128: "code_128",
  ZBAR_EAN13: "ean_13", // UPC-A also arrives as zero-padded EAN13 — checksum still valid
  ZBAR_EAN8: "ean_8",
  ZBAR_UPCA: "upc_a",
  ZBAR_UPCE: "upc_e",
}

async function zbarDetect(image: ImageData): Promise<DetectedCode[]> {
  const mod = await loadZBar()
  if (!mod) return []
  try {
    const symbols = await mod.scanImageData(image)
    return symbols
      .map((s): DetectedCode => {
        let box: CodeBox | undefined
        const pts = s.points
        if (pts && pts.length > 0) {
          const xs = pts.map((p) => p.x)
          const ys = pts.map((p) => p.y)
          const x = Math.min(...xs)
          const y = Math.min(...ys)
          box = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
        }
        return { rawValue: s.decode(), format: ZBAR_TO_FORMAT[s.typeName], box }
      })
      .filter((c) => Boolean(c.format && c.rawValue))
  } catch {
    return []
  }
}

// Fallback crops tried (alternating) when the full frame doesn't decode:
// a wide center band, then a tight center zoom for small/far labels.
const FALLBACK_CROPS = [
  { x: 0.1, y: 0.25, w: 0.8, h: 0.5, scale: 2 },
  { x: 0.225, y: 0.34, w: 0.55, h: 0.32, scale: 3 },
] as const

/**
 * Fast-first, deep-later detection on a live frame:
 *   every attempt   — ZXing on the full frame (fast: keeps the loop at a
 *                     high scan rate, which matters more than any single
 *                     heavyweight pass on live video)
 *   every 4th (±)   — ZBar on the full frame (reads dense codes ~40%
 *                     smaller than ZXing)
 *   every 4th (±)   — cropped+upscaled center region through both engines
 * The heavy passes are interleaved so the primary loop never drops below a
 * usable scan rate on weak devices.
 */
export async function detectCodes(
  detector: DetectorLike,
  video: HTMLVideoElement,
  work: HTMLCanvasElement,
  attempt = 0,
): Promise<DetectedCode[]> {
  const primary = await detector.detect(video)
  if (primary.length > 0) {
    return primary.map((c) => ({ ...c, box: c.box ?? nativeBox(c) }))
  }
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return []
  const phase = attempt % 4
  if (phase !== 1 && phase !== 3) return []
  const ctx = work.getContext("2d", { willReadFrequently: true })
  if (!ctx) return []

  if (phase === 1) {
    // ZBar over the whole frame at capture resolution.
    if (work.width !== vw) work.width = vw
    if (work.height !== vh) work.height = vh
    ctx.drawImage(video, 0, 0, vw, vh)
    return zbarDetect(ctx.getImageData(0, 0, vw, vh))
  }

  // phase 3: center crop, upscaled — both engines. Boxes come back in crop
  // coordinates and are mapped to frame coordinates before returning.
  const crop = FALLBACK_CROPS[Math.floor(attempt / 4) % FALLBACK_CROPS.length]
  const sx = vw * crop.x
  const sy = vh * crop.y
  const sw = vw * crop.w
  const sh = vh * crop.h
  const w = Math.round(sw * crop.scale)
  const h = Math.round(sh * crop.scale)
  work.width = w
  work.height = h
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
  try {
    const cropped = await detector.detect(work)
    if (cropped.length > 0) {
      return cropped.map((c) => ({
        ...c,
        box: unmapBox(c.box ?? nativeBox(c), sx, sy, crop.scale),
      }))
    }
  } catch {
    /* fall through to zbar */
  }
  const viaZbar = await zbarDetect(ctx.getImageData(0, 0, w, h))
  return viaZbar.map((c) => ({ ...c, box: unmapBox(c.box, sx, sy, crop.scale) }))
}

/**
 * Decode a still photo from the native camera (file input capture). A 12MP
 * tap-to-focus photo carries ~5-10× the pixel detail of a video frame —
 * measured: labels that need ≥300px symbol width in video decode from
 * photos even blurred, tilted 12° and JPEG-compressed. This is the
 * last-resort path that makes stubborn labels scannable everywhere,
 * including in-app webviews.
 */
export async function detectFromPhoto(
  detector: DetectorLike,
  file: Blob,
): Promise<DetectedCode[]> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return []
  }
  try {
    const direct = await detector.detect(bmp)
    if (direct.length > 0) return direct
    // Retry at descending scales through BOTH engines: downscaling averages
    // sensor noise + JPEG ringing; ZBar reads dense symbols ZXing misses.
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return []
    for (const scale of [1, 0.5, 0.25]) {
      const w = Math.round(bmp.width * scale)
      const h = Math.round(bmp.height * scale)
      if (scale < 1 && w < 640) break
      if (w > 4000 || h > 4000) continue // huge photos: skip full-size pass
      canvas.width = w
      canvas.height = h
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(bmp, 0, 0, w, h)
      if (scale < 1) {
        const viaDetector = await detector.detect(canvas)
        if (viaDetector.length > 0) return viaDetector
      }
      const viaZbar = await zbarDetect(ctx.getImageData(0, 0, w, h))
      if (viaZbar.length > 0) return viaZbar
    }
    return []
  } catch {
    return []
  } finally {
    bmp.close?.()
  }
}

export type FacingMode = "environment" | "user"

export async function getCameraStream(
  facing: FacingMode = "environment",
): Promise<MediaStream> {
  const advanced = [
    { focusMode: "continuous" },
  ] as unknown as MediaTrackConstraintSet[]
  // 1080p: the sweet spot between per-frame decode cost (scan rate) and
  // pixels-per-module. Zoom defaults to ×1 (like reference scanners) — the
  // user has a zoom slider for small/far labels.
  const tuned: MediaTrackConstraints = {
    facingMode: { ideal: facing },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
    advanced,
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: tuned, audio: false })
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing },
      audio: false,
    })
  }
}

/**
 * Map a frame-coordinate box onto the displayed <video> element (which uses
 * object-cover, so the frame is scaled+cropped). Returns CSS px for absolute
 * positioning inside the video's container; `mirrored` flips X for the
 * front camera's -scale-x-100 preview.
 */
export function frameBoxToDisplay(
  video: HTMLVideoElement,
  b: CodeBox,
  mirrored = false,
): { left: number; top: number; width: number; height: number } | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const rw = video.clientWidth
  const rh = video.clientHeight
  if (!vw || !vh || !rw || !rh) return null
  const scale = Math.max(rw / vw, rh / vh)
  const ox = (rw - vw * scale) / 2
  const oy = (rh - vh * scale) / 2
  let left = b.x * scale + ox
  const width = b.w * scale
  if (mirrored) left = rw - left - width
  return { left, top: b.y * scale + oy, width, height: b.h * scale }
}

/** Zoom capability of a live stream's camera, or null when unsupported. */
export function getZoomRange(
  stream: MediaStream | null,
): { min: number; max: number; value: number } | null {
  const track = stream?.getVideoTracks?.()[0]
  const caps = track?.getCapabilities?.() as
    | (MediaTrackCapabilities & { zoom?: { min?: number; max?: number } })
    | undefined
  const zoom = caps?.zoom
  if (!track || !zoom?.max || zoom.max <= 1) return null
  const settings = track.getSettings() as MediaTrackSettings & { zoom?: number }
  return {
    min: Math.max(1, zoom.min ?? 1),
    max: zoom.max,
    value: settings.zoom ?? 1,
  }
}

/** Set camera zoom on a live stream. Returns false when unsupported. */
export async function setZoom(
  stream: MediaStream | null,
  value: number,
): Promise<boolean> {
  const track = stream?.getVideoTracks?.()[0]
  if (!track) return false
  try {
    await track.applyConstraints({
      advanced: [{ zoom: value }] as unknown as MediaTrackConstraintSet[],
    })
    return true
  } catch {
    return false
  }
}


export function cameraHasTorch(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks?.()[0]
  if (!track?.getCapabilities) return false
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    torch?: boolean
  }
  return Boolean(caps.torch)
}

export async function setTorch(
  stream: MediaStream | null,
  on: boolean,
): Promise<boolean> {
  const track = stream?.getVideoTracks?.()[0]
  if (!track) return false
  try {
    await track.applyConstraints({
      advanced: [{ torch: on }] as unknown as MediaTrackConstraintSet[],
    })
    return true
  } catch {
    return false
  }
}
