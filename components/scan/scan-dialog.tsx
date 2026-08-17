"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  Flashlight,
  FlashlightOff,
  Loader2,
  ScanBarcode,
  Camera,
  SwitchCamera,
  TriangleAlert,
  X,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { usePortraitLock } from "@/hooks/use-portrait-lock"
import { cn } from "@/lib/utils"
import { ensureAudio, playBeep } from "@/lib/beep"
import {
  cameraHasTorch,
  createDetector,
  createScanGate,
  detectCodes,
  detectFromPhoto,
  frameBoxToDisplay,
  getCameraStream,
  getZoomRange,
  isValidProductBarcode,
  SCANNER_BUILD,
  setTorch,
  setZoom,
  type DetectorLike,
  type FacingMode,
} from "@/lib/scan/decoder"

/** What a scan handler reports back: added fine, or rejected (and why). */
export type ScanFeedback = { ok: boolean; message: string }
export type ScanDetectResult =
  | void
  | null
  | string
  | ScanFeedback
  | Promise<void | null | string | ScanFeedback>

export function normalizeScanResult(
  res: void | null | string | ScanFeedback,
): ScanFeedback {
  if (res && typeof res === "object") return res
  return { ok: true, message: typeof res === "string" && res ? res : "تمت الإضافة" }
}

/**
 * Camera barcode scanner. Mobile-first (rear camera), with a manual-entry
 * fallback for desktops / denied permissions.
 *
 * In `continuous` mode the camera stays on after each detection: a brief
 * confirmation banner shows (the string returned by `onDetect`), then
 * scanning resumes — built for rapid multi-item POS scanning. `statusBar`
 * renders live info (e.g. cart total) under the viewfinder.
 */
export function ScanDialog({
  open,
  onOpenChange,
  onDetect,
  continuous = false,
  statusBar,
  title = "مسح الباركود",
  description = "وجّه الكاميرا نحو باركود المنتج",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDetect: (code: string) => ScanDetectResult
  continuous?: boolean
  statusBar?: React.ReactNode
  title?: string
  description?: string
}) {
  // Never flip to landscape mid-scan — rotating re-lays out (and on some
  // devices restarts) the camera stream.
  usePortraitLock(open)

  const videoRef = useRef<HTMLVideoElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pausedRef = useRef(false)
  const lastRef = useRef({ code: "", t: 0 })
  const [status, setStatus] = useState<"starting" | "scanning" | "error">(
    "starting",
  )
  const [banner, setBanner] = useState<ScanFeedback | null>(null)
  const [manual, setManual] = useState("")
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvail, setTorchAvail] = useState(false)
  // Actual capture resolution — shown beside the build marker; tells us
  // instantly whether a device/webview is delivering enough pixels to decode.
  const [capRes, setCapRes] = useState("")
  // Highlight box drawn over a detected barcode (display px), like dedicated
  // scanner apps — instant "I can see it" feedback while the gate confirms.
  const [hitBox, setHitBox] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const hitBoxTimer = useRef(0)
  // Camera zoom slider (only rendered when the camera supports zoom).
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)
  const [zoomVal, setZoomVal] = useState(1)
  const [facing, setFacing] = useState<FacingMode>("environment")
  const facingRef = useRef<FacingMode>("environment")
  const restartRef = useRef<() => void>(() => {})

  // Latest-value refs so the scan loop never captures stale props and the
  // camera effect doesn't restart on every parent render.
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const continuousRef = useRef(continuous)
  continuousRef.current = continuous
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  /** Last-resort path: one native-camera photo (tap-to-focus, full res) —
   * decodes labels too small/blurry for the live video stream. */
  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || photoBusy) return
    setPhotoBusy(true)
    try {
      const detector = await createDetector()
      const codes = await detectFromPhoto(detector, file)
      const hit = codes.find((c) => isValidProductBarcode(c.rawValue, c.format))
      if (hit) {
        void fire(hit.rawValue)
      } else {
        playBeep(false)
        setBanner({
          ok: false,
          message: "لم يُقرأ باركود واضح من الصورة — اقترب أكثر وحاول مجدداً",
        })
        window.setTimeout(() => setBanner(null), 1800)
      }
    } finally {
      setPhotoBusy(false)
    }
  }

  async function toggleTorch() {
    const next = !torchOn
    if (await setTorch(streamRef.current, next)) setTorchOn(next)
  }

  function flipCamera() {
    const next = facingRef.current === "environment" ? "user" : "environment"
    facingRef.current = next
    setFacing(next)
    restartRef.current()
  }

  const fire = useCallback(
    async (code: string) => {
      if (!code) return
      if (!continuousRef.current) {
        playBeep(true)
        try {
          navigator.vibrate?.(60)
        } catch {
          /* unsupported */
        }
        stop()
        onOpenChangeRef.current(false)
        void onDetectRef.current(code)
        return
      }
      // Continuous: resolve the code FIRST, then give matching feedback —
      // the familiar chirp when it lands in the cart, an unmistakable red
      // flash + error buzz when nothing was added.
      pausedRef.current = true
      let fb: ScanFeedback
      try {
        fb = normalizeScanResult(await onDetectRef.current(code))
      } catch {
        fb = { ok: false, message: "حدث خطأ" }
      }
      playBeep(fb.ok)
      try {
        navigator.vibrate?.(fb.ok ? 60 : [90, 60, 90])
      } catch {
        /* unsupported */
      }
      setBanner(fb)
      window.setTimeout(
        () => {
          setBanner(null)
          pausedRef.current = false
        },
        fb.ok ? 700 : 1400,
      )
    },
    [stop],
  )

  useEffect(() => {
    if (!open) {
      stop()
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    let detector: DetectorLike | null = null
    let restarting = false
    let busy = false
    let loopStopped = false
    let attempt = 0
    const work = document.createElement("canvas")
    const gate = createScanGate()
    // Opening the dialog is a user gesture — unlock audio for the beeps.
    ensureAudio()
    pausedRef.current = false
    lastRef.current = { code: "", t: 0 }
    setBanner(null)

    function cameraDead() {
      const v = videoRef.current
      const track = streamRef.current?.getVideoTracks?.()[0]
      return (
        !streamRef.current ||
        !track ||
        track.readyState === "ended" ||
        (v ? v.readyState < 2 && v.error != null : true)
      )
    }

    async function tick() {
      const v = videoRef.current
      if (!v || pausedRef.current) return
      if (cameraDead()) {
        void restart()
        return
      }
      if (v.readyState < 2 || !detector || busy) return
      busy = true
      try {
        const codes = await detectCodes(detector, v, work, attempt++)
        if (codes.length === 0) return
        const now = Date.now()
        // Offer at most ONE code per frame — the first valid one — so a
        // second symbol or a garbage read in frame can't churn/reset the gate.
        const hit = codes.find((c) => isValidProductBarcode(c.rawValue, c.format))
        if (!hit) return
        // Draw the highlight box the moment we SEE the code (pre-confirm).
        if (hit.box) {
          const rect = frameBoxToDisplay(v, hit.box, facingRef.current === "user")
          if (rect) {
            setHitBox(rect)
            window.clearTimeout(hitBoxTimer.current)
            hitBoxTimer.current = window.setTimeout(() => setHitBox(null), 450)
          }
        }
        const code = gate.offer(hit.rawValue, now, hit.format)
        if (!code) return
        // Don't re-add the same barcode while it's still in frame.
        if (code === lastRef.current.code && now - lastRef.current.t < 2200) {
          return
        }
        lastRef.current = { code, t: now }
        if (!continuousRef.current) loopStopped = true
        void fire(code)
      } catch {
        /* frame not ready — keep scanning */
      } finally {
        busy = false
      }
    }

    async function acquire() {
      setStatus("starting")
      setManual("")
      pausedRef.current = false
      lastRef.current = { code: "", t: 0 }
      gate.reset()
      try {
        if (!detector) detector = await createDetector()
        const s = await getCameraStream(facingRef.current)
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        const st = s.getVideoTracks()[0]?.getSettings?.()
        setCapRes(st?.width && st?.height ? `${st.width}×${st.height}` : "")
        const zr = getZoomRange(s)
        setZoomRange(zr ? { min: zr.min, max: zr.max } : null)
        setZoomVal(zr?.value ?? 1)
        setTorchOn(false)
        setTorchAvail(cameraHasTorch(s))
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play()
        setStatus("scanning")
        // Continuous scan loop: the next attempt starts as soon as the
        // previous decode finishes (rAF-paced) — 5-10× the effective scan
        // rate of a fixed timer, which is what makes scanning feel instant.
        if (timer) clearInterval(timer)
        loopStopped = false
        const mine = s
        const pump = () => {
          if (cancelled || loopStopped || streamRef.current !== mine) return
          void tick().finally(() => {
            if (!cancelled && !loopStopped && streamRef.current === mine) {
              requestAnimationFrame(pump)
            }
          })
        }
        requestAnimationFrame(pump)
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    async function restart() {
      if (restarting || cancelled) return
      restarting = true
      if (timer) clearInterval(timer)
      stop()
      await acquire()
      restarting = false
    }
    restartRef.current = () => void restart()

    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled && cameraDead()) {
        void restart()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    void acquire()
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      if (timer) clearInterval(timer)
      stop()
    }
  }, [open, fire, stop])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* initialFocus on the viewfinder keeps the mobile keyboard closed
          (otherwise the manual-entry input grabs focus and shifts the page). */}
      <DialogContent
        className="max-w-lg overflow-hidden p-0"
        initialFocus={videoWrapRef}
      >
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <span className="icon-chip bg-brand-gradient size-9">
              <ScanBarcode className="size-5" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div
            ref={videoWrapRef}
            tabIndex={-1}
            className="relative h-[56dvh] max-h-[600px] min-h-[320px] w-full overflow-hidden rounded-2xl bg-ink outline-none"
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "size-full object-cover",
                facing === "user" && "-scale-x-100",
              )}
            />
            {status === "starting" && (
              <div className="absolute inset-0 grid place-items-center text-white/80">
                <Loader2 className="size-7 animate-spin" />
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/85">
                <div className="flex flex-col items-center gap-2">
                  <TriangleAlert className="size-7 text-warning" />
                  تعذر تشغيل الكاميرا — تأكد من السماح بالوصول، أو أدخل
                  الباركود يدوياً بالأسفل.
                </div>
              </div>
            )}
            {status === "scanning" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                {/* Corner frame */}
                <div className="absolute inset-x-10 inset-y-8">
                  {(
                    [
                      "top-0 start-0 border-t-2 border-s-2 rounded-ss-xl",
                      "top-0 end-0 border-t-2 border-e-2 rounded-se-xl",
                      "bottom-0 start-0 border-b-2 border-s-2 rounded-es-xl",
                      "bottom-0 end-0 border-b-2 border-e-2 rounded-ee-xl",
                    ] as const
                  ).map((pos) => (
                    <span
                      key={pos}
                      className={`absolute size-7 border-lime ${pos}`}
                    />
                  ))}
                  {/* Sweeping scan line */}
                  <span className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse rounded-full bg-lime shadow-[0_0_16px_2px_var(--lime)]" />
                </div>
                {/* Build marker + capture res: which scanner build this device
                    actually runs, and whether the camera gives enough pixels */}
                <span className="absolute bottom-1.5 end-2 text-[10px] font-medium text-white/40" dir="ltr">
                  {SCANNER_BUILD}
                  {capRes ? ` · ${capRes}` : ""}
                </span>
              </div>
            )}
            {/* Live highlight around the barcode the engine is locking onto */}
            {hitBox && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-10 rounded-md border-2 border-lime bg-lime/10 shadow-[0_0_14px_2px_var(--lime)] transition-all duration-75"
                style={{
                  left: hitBox.left,
                  top: hitBox.top,
                  width: hitBox.width,
                  height: hitBox.height,
                }}
              />
            )}
            {/* Camera zoom (rendered only when the camera supports it) */}
            {status === "scanning" && zoomRange && (
              <input
                type="range"
                aria-label="تقريب الكاميرا"
                min={zoomRange.min}
                max={Math.min(zoomRange.max, 8)}
                step={0.1}
                value={zoomVal}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setZoomVal(v)
                  void setZoom(streamRef.current, v)
                }}
                className="absolute inset-x-16 bottom-3 z-10 h-1.5 cursor-pointer accent-lime"
                dir="ltr"
              />
            )}
            {status === "scanning" && (
              <button
                type="button"
                onClick={flipCamera}
                className="absolute start-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90"
                aria-label="تبديل الكاميرا"
              >
                <SwitchCamera className="size-5" />
              </button>
            )}
            {status === "scanning" && torchAvail && (
              <button
                type="button"
                onClick={toggleTorch}
                className="absolute end-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90"
                aria-label={torchOn ? "إطفاء الفلاش" : "تشغيل الفلاش"}
              >
                {torchOn ? (
                  <FlashlightOff className="size-5" />
                ) : (
                  <Flashlight className="size-5" />
                )}
              </button>
            )}
            {/* Rejected scan: the whole viewfinder flashes red */}
            {banner && !banner.ok && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 animate-pulse bg-destructive/45 ring-4 ring-inset ring-destructive"
              />
            )}
            {/* Continuous-mode confirmation flash */}
            {banner && (
              <div className="animate-in fade-in slide-in-from-bottom-2 absolute inset-x-3 bottom-3 duration-200">
                <div
                  className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg ${
                    banner.ok
                      ? "bg-lime text-lime-foreground"
                      : "bg-destructive text-white"
                  }`}
                >
                  {banner.ok ? <Check className="size-4" /> : <X className="size-4" />}
                  <span className="truncate">{banner.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Live info while scanning (e.g. cart total) */}
          {statusBar && (
            <div className="mt-2.5 rounded-2xl bg-muted/60 px-4 py-2.5">
              {statusBar}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 px-5 pb-5">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void fire(manual.trim())
              setManual("")
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="أو أدخل الباركود يدوياً…"
              dir="ltr"
              inputMode="numeric"
              className="text-start"
            />
            <Button type="submit" variant="secondary" disabled={!manual.trim()}>
              بحث
            </Button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPhotoPicked(e)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={photoBusy}
              onClick={() => photoInputRef.current?.click()}
              aria-label="مسح من صورة عالية الدقة"
            >
              {photoBusy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Camera className="size-5" />
              )}
            </Button>
          </form>
          {continuous && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime font-heading text-base font-bold text-lime-foreground shadow-lg shadow-lime/30 transition hover:brightness-95 active:scale-[0.98]"
            >
              <Check className="size-5" />
              تم — إنهاء المسح
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
