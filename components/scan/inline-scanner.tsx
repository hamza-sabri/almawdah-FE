"use client"

import { useEffect, useRef, useState } from "react"
import {
  Camera,
  Check,
  Flashlight,
  FlashlightOff,
  Loader2,
  RotateCcw,
  SwitchCamera,
  TriangleAlert,
  X,
} from "lucide-react"
import { ensureAudio, playBeep } from "@/lib/beep"
import {
  normalizeScanResult,
  type ScanDetectResult,
  type ScanFeedback,
} from "@/components/scan/scan-dialog"
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
import { usePortraitLock } from "@/hooks/use-portrait-lock"
import { cn } from "@/lib/utils"

/** A round control button used in the bottom-bar layout. */
const BAR_BTN =
  "grid size-12 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur active:scale-90 disabled:opacity-60"

/**
 * Embedded always-on scanner pane (no dialog): rear camera, continuous
 * detection with beep + confirmation banner. Made for the POS cart sheet —
 * scan, watch the line pop into the list below, keep scanning.
 */
export function InlineScanner({
  onDetect,
  className,
  silent = false,
  volume = 1,
  paused = false,
  controls = "corners",
  children,
}: {
  onDetect: (code: string) => ScanDetectResult
  className?: string
  /** No sounds — haptics/visuals only. Can be toggled live. */
  silent?: boolean
  /** Beep loudness 0..1 (customer page uses a low value). */
  volume?: number
  /** External pause — stop detecting new codes (e.g. while a result sheet is open). */
  paused?: boolean
  /** Control layout: four corners (default) or one centered bottom bar. */
  controls?: "corners" | "bar"
  /** Extra control(s) rendered inside the bottom bar — e.g. a sound toggle. */
  children?: React.ReactNode
}) {
  // The camera pane is always portrait — rotating mid-scan re-lays out (and on
  // some devices restarts) the stream.
  usePortraitLock(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  // Refs so the scan loop (a long-lived closure) always sees the LATEST
  // values — otherwise it keeps calling the handler captured at mount, which
  // in the POS is bound to whichever cart was active back then (→ "scanned
  // but nothing added" after switching/parking carts).
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const silentRef = useRef(silent)
  silentRef.current = silent
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  // External pause (result sheet open) vs internal pause (mid-scan cooldown).
  const pausedExtRef = useRef(paused)
  pausedExtRef.current = paused
  const pausedRef = useRef(false)
  const lastRef = useRef({ code: "", t: 0 })
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<"starting" | "scanning" | "error">(
    "starting",
  )
  // The camera froze on a dead frame (phone slept / app was backgrounded) with
  // no "ended" event — happens on both iOS and Android. We stop guessing whether
  // a silent restart will work and just surface a refresh dialog.
  const [stuck, setStuck] = useState(false)
  const [banner, setBanner] = useState<ScanFeedback | null>(null)
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

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  /** Last-resort path: one native-camera photo (tap-to-focus, full res) —
   * decodes labels too small/blurry for the live video stream. */
  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || photoBusy) return
    setPhotoBusy(true)
    pausedRef.current = true
    let fb: ScanFeedback
    try {
      const detector = await createDetector()
      const codes = await detectFromPhoto(detector, file)
      const hit = codes.find((c) => isValidProductBarcode(c.rawValue, c.format))
      if (hit) {
        try {
          fb = normalizeScanResult(await onDetectRef.current(hit.rawValue))
        } catch {
          fb = { ok: false, message: "حدث خطأ" }
        }
      } else {
        fb = { ok: false, message: "لم يُقرأ باركود واضح من الصورة — اقترب أكثر وحاول مجدداً" }
      }
    } catch {
      fb = { ok: false, message: "حدث خطأ" }
    }
    if (!silentRef.current) playBeep(fb.ok, volumeRef.current)
    setBanner(fb)
    window.setTimeout(
      () => {
        setBanner(null)
        pausedRef.current = false
      },
      fb.ok ? 600 : 1600,
    )
    setPhotoBusy(false)
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

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let detector: DetectorLike | null = null
    let restarting = false
    let busy = false
    let attempt = 0
    // Freeze-watchdog bookkeeping: last observed video time + when it last moved.
    let lastCT = 0
    let lastProgressAt = Date.now()
    const work = document.createElement("canvas")
    const gate = createScanGate()
    if (!silent) ensureAudio()

    function stopStream() {
      if (timer) clearInterval(timer)
      timer = undefined
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      streamRef.current = null
    }

    function cameraDead() {
      const v = videoRef.current
      const track = stream?.getVideoTracks?.()[0]
      // Track ended (sleep/wake), or the video element lost its data.
      return !stream || !track || track.readyState === "ended" || (v ? v.readyState < 2 && v.error != null : true)
    }

    async function tick() {
      const v = videoRef.current
      if (!v || pausedRef.current || pausedExtRef.current) return
      // Camera died (phone slept, OS reclaimed the sensor) → bring it back.
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
        if (code === lastRef.current.code && now - lastRef.current.t < 2200) {
          return
        }
        lastRef.current = { code, t: now }
        pausedRef.current = true
        // Resolve via the LATEST handler, then give feedback.
        let fb: ScanFeedback
        try {
          fb = normalizeScanResult(await onDetectRef.current(code))
        } catch {
          fb = { ok: false, message: "حدث خطأ" }
        }
        if (!silentRef.current) playBeep(fb.ok, volumeRef.current)
        try {
          navigator.vibrate?.(fb.ok ? 40 : [150, 80, 250])
        } catch {
          /* unsupported */
        }
        setBanner(fb)
        window.setTimeout(
          () => {
            setBanner(null)
            gate.reset()
            pausedRef.current = false
          },
          fb.ok ? 600 : 1400,
        )
      } catch {
        /* frame not ready — keep scanning */
      } finally {
        busy = false
      }
    }

    async function acquire() {
      setStatus("starting")
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
        stream = s
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
        // Fresh stream is live — reset the freeze-watchdog baseline.
        lastCT = 0
        lastProgressAt = Date.now()
        setStuck(false)
        // Continuous scan loop: the next attempt starts as soon as the
        // previous decode finishes (rAF-paced) — 5-10× the effective scan
        // rate of a fixed timer, which is what makes scanning feel instant.
        if (timer) clearInterval(timer)
        const pump = () => {
          if (cancelled || stream !== s) return
          void tick().finally(() => {
            if (!cancelled && stream === s) requestAnimationFrame(pump)
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
      stopStream()
      await acquire()
      restarting = false
    }
    restartRef.current = () => void restart()

    // A slept phone often only wakes the page on visibility change — recover
    // the camera the instant the tab is shown again.
    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled && cameraDead()) {
        void restart()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    // Freeze watchdog: while the pane is visible and not intentionally paused,
    // the video's currentTime must keep advancing. If it flatlines for a few
    // seconds (post-sleep / post-background freeze — no "ended" event fires on
    // many devices), surface the refresh dialog instead of a silently dead cam.
    const STUCK_MS = 3500
    const watchdog = window.setInterval(() => {
      if (cancelled) return
      const v = videoRef.current
      if (
        !v ||
        pausedRef.current ||
        pausedExtRef.current ||
        document.hidden ||
        v.readyState < 2
      ) {
        lastProgressAt = Date.now() // not expected to advance right now
        return
      }
      const ct = v.currentTime
      if (ct > lastCT + 0.05) {
        lastCT = ct
        lastProgressAt = Date.now()
        setStuck(false)
        return
      }
      if (Date.now() - lastProgressAt > STUCK_MS) setStuck(true)
    }, 1000)

    void acquire()
    return () => {
      cancelled = true
      window.clearInterval(watchdog)
      document.removeEventListener("visibilitychange", onVisible)
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-ink",
        className,
      )}
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
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/85">
          <div className="flex flex-col items-center gap-1.5">
            <TriangleAlert className="size-6 text-warning" />
            تعذر تشغيل الكاميرا — تأكد من السماح بالوصول.
          </div>
        </div>
      )}
      {status === "scanning" && !paused && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-8 inset-y-4">
            {(
              [
                "top-0 start-0 border-t-2 border-s-2 rounded-ss-xl",
                "top-0 end-0 border-t-2 border-e-2 rounded-se-xl",
                "bottom-0 start-0 border-b-2 border-s-2 rounded-es-xl",
                "bottom-0 end-0 border-b-2 border-e-2 rounded-ee-xl",
              ] as const
            ).map((pos) => (
              <span key={pos} className={`absolute size-5 border-lime ${pos}`} />
            ))}
            <span className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse rounded-full bg-lime shadow-[0_0_16px_2px_var(--lime)]" />
          </div>
          {/* Build marker + capture res: which scanner build this device
              actually runs, and whether the camera gives enough pixels.
              Hidden in the customer-facing bar layout. */}
          {controls === "corners" && (
            <span className="absolute bottom-1 end-1.5 text-[10px] font-medium text-white/40" dir="ltr">
              {SCANNER_BUILD}
              {capRes ? ` · ${capRes}` : ""}
            </span>
          )}
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
      {status === "scanning" && !paused && zoomRange && (
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
          className={cn(
            "absolute inset-x-14 z-10 h-1.5 cursor-pointer accent-lime",
            controls === "bar" ? "bottom-20" : "bottom-2.5",
          )}
          dir="ltr"
        />
      )}
      {status === "scanning" && (
        <>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPhotoPicked(e)}
          />
          {controls === "bar" ? (
            // One clean centered control bar — leaves the top free for the
            // page's logo/search (no more buttons stacked under them).
            <div
              className={cn(
                "absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-3",
                paused && "hidden",
              )}
            >
              <button type="button" onClick={flipCamera} aria-label="تبديل الكاميرا" className={BAR_BTN}>
                <SwitchCamera className="size-5" />
              </button>
              {torchAvail && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-label={torchOn ? "إطفاء الفلاش" : "تشغيل الفلاش"}
                  className={BAR_BTN}
                >
                  {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                aria-label="مسح من صورة عالية الدقة"
                className={BAR_BTN}
              >
                {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
              </button>
              {children}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={flipCamera}
                className="absolute start-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90"
                aria-label="تبديل الكاميرا"
              >
                <SwitchCamera className="size-4" />
              </button>
              {torchAvail && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="absolute end-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90"
                  aria-label={torchOn ? "إطفاء الفلاش" : "تشغيل الفلاش"}
                >
                  {torchOn ? <FlashlightOff className="size-4" /> : <Flashlight className="size-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                className="absolute bottom-2 start-2 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90 disabled:opacity-60"
                aria-label="مسح من صورة عالية الدقة"
              >
                {photoBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
            </>
          )}
        </>
      )}
      {banner && !banner.ok && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-pulse bg-destructive/45 ring-4 ring-inset ring-destructive"
        />
      )}
      {banner && (
        <div className="animate-in fade-in slide-in-from-bottom-2 absolute inset-x-2 bottom-2 duration-200">
          <div
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg",
              banner.ok
                ? "bg-lime text-lime-foreground"
                : "bg-destructive text-white",
            )}
          >
            {banner.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            <span className="truncate">{banner.message}</span>
          </div>
        </div>
      )}

      {/* Freeze recovery — the camera stopped delivering frames after a sleep or
          app-switch. A refresh reliably brings it back on every device, so we
          ask for that instead of hoping a silent restart takes on this phone. */}
      {stuck && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-6 text-center backdrop-blur-sm">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-background p-6 shadow-2xl">
            <span className="grid size-14 place-items-center rounded-full bg-warning/15 text-warning">
              <TriangleAlert className="size-7" />
            </span>
            <p className="font-heading text-lg font-bold text-foreground">الكاميرا توقفت</p>
            <p className="text-sm text-muted-foreground">
              قد يحدث هذا بعد قفل الشاشة أو الخروج من التطبيق. حدّث الصفحة لإعادة تشغيل الكاميرا.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-heading text-base font-bold text-white active:scale-95"
            >
              <RotateCcw className="size-5" /> تحديث الصفحة
            </button>
            <button
              type="button"
              onClick={() => {
                setStuck(false)
                restartRef.current()
              }}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              إعادة المحاولة بدون تحديث
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
