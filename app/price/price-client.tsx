"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Clock, Heart, Package, RotateCcw, Share2, Volume2, VolumeX, X } from "lucide-react"

import { API_BASE } from "@/api/http"
import { VideoPlayer } from "@/components/video-player"
import { InlineScanner } from "@/components/scan/inline-scanner"
import type { ScanFeedback } from "@/components/scan/scan-dialog"
import { BrandMark } from "@/components/brand"
import { ensureAudio, isMuted, setMuted } from "@/lib/beep"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isAuthenticated } from "@/lib/tokens"
import { getPharmacySlug } from "@/lib/site"
import { PriceQrDialog } from "@/components/reports/price-qr-card"
import { ProductShareButton } from "@/components/price/product-share"
import { BottomNav } from "@/components/bottom-nav"
import { LockedFeatureProvider } from "@/components/locked-feature"

type PriceResult = {
  found: boolean
  name?: string
  price?: string | null
  image?: string
  images?: string[]
  video_url?: string
  barcode?: string
}
type Branding = { name: string; logo: string }
type Saved = { id: string; name: string; price?: string | null; image?: string; barcode?: string; at?: number }
type Media = { type: "image" | "video"; url: string }

/**
 * The store whose prices this public page shows.
 *
 * Uses the shared resolver — this page used to parse the host itself and fall
 * back to a hardcoded "alrahmah", which meant any unrecognised host showed
 * Al-Rahmah's prices to someone else's customers.
 */
function pharmacySlug(): string {
  return getPharmacySlug()
}
function priceCheckUrl(params: Record<string, string>): string {
  const q = new URLSearchParams({ store: pharmacySlug(), ...params })
  return `${API_BASE}/api/v1/public/price-check/?${q.toString()}`
}
async function lookupBarcode(barcode: string): Promise<PriceResult> {
  const res = await fetch(priceCheckUrl({ barcode }))
  if (!res.ok) throw new Error("network")
  const data = (await res.json()) as PriceResult
  return { ...data, barcode }
}
/** Fire-and-forget scan counter for the store's price-scan report. Silent by
 *  design — no await, no retry, no UI. Uses sendBeacon so it never competes with
 *  the price lookup or makes the customer wait; if it fails, it just fails. */
function logScan(
  barcode: string,
  found: boolean,
  source: "scan" | "share" = "scan",
): void {
  try {
    const q = new URLSearchParams({
      store: pharmacySlug(),
      barcode,
      found: found ? "1" : "0",
      // Tagged so a shared-link open doesn't get counted as someone standing
      // in the aisle — mixing the two would poison the "what are customers
      // looking at in store" signal the owner uses to reorder.
      source,
    })
    const url = `${API_BASE}/api/v1/public/scan-log/?${q.toString()}`
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url)
    } else if (typeof fetch === "function") {
      void fetch(url, { method: "POST", keepalive: true, mode: "no-cors" }).catch(() => {})
    }
  } catch {
    /* best-effort analytics — never touches the customer experience */
  }
}
async function fetchBranding(): Promise<Branding | null> {
  try {
    const q = new URLSearchParams({ store: pharmacySlug() })
    const res = await fetch(`${API_BASE}/api/v1/public/branding/?${q.toString()}`)
    if (!res.ok) return null
    return (await res.json()) as Branding
  } catch {
    return null
  }
}

/* Favourites + history are a rolling 3h window — this is a shared customer
   kiosk, so yesterday's scans shouldn't linger. Each item carries the time it
   was saved; anything older than MAX_AGE_MS (or unstamped/legacy) is dropped. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000

/* localStorage, namespaced per store so favourites/history never mix. */
const load = (key: string): Saved[] => {
  try {
    const list = JSON.parse(window.localStorage.getItem(key) || "[]") as Saved[]
    const cutoff = Date.now() - MAX_AGE_MS
    return list.filter((x) => typeof x.at === "number" && x.at >= cutoff)
  } catch {
    return []
  }
}
const save = (key: string, list: Saved[]) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* storage full */
  }
}
const idOf = (r: { barcode?: string; name?: string }) => (r.barcode || r.name || "").trim()

/**
 * `?barcode=` — someone opened a product a customer shared with them.
 *
 * Read once, at mount. Its presence means "show me this product", NOT "let me
 * scan": the camera stays unmounted, because a relative who tapped a WhatsApp
 * link should never be met with a camera-permission prompt.
 */
function sharedBarcode(): string | null {
  if (typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("barcode")
  return v && v.trim() ? v.trim() : null
}

export default function PriceClient() {
  const slug = useMemo(() => pharmacySlug(), [])
  const favKey = `pharma_favs_${slug}`
  const histKey = `pharma_hist_${slug}`

  // Read once — a later re-render must not re-trigger the shared-link lookup.
  const [shared] = useState<string | null>(sharedBarcode)
  // The camera is OFF when we arrived from a shared link (see sharedBarcode).
  const [cameraOn, setCameraOn] = useState<boolean>(() => sharedBarcode() === null)

  const [result, setResult] = useState<PriceResult | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [favs, setFavs] = useState<Saved[]>([])
  const [history, setHistory] = useState<Saved[]>([])
  const [sheet, setSheet] = useState<null | "favs" | "history">(null)
  const [slide, setSlide] = useState(0)
  const carousel = useRef<HTMLDivElement>(null)
  // Drag-to-dismiss for the result sheet.
  const [dragY, setDragY] = useState(0)
  const dragStart = useRef<number | null>(null)

  // Single source of truth for sound = beep.ts isMuted(). The old bug was the
  // page thinking sound was ON while a stale localStorage mute killed the beep.
  useEffect(() => {
    setSoundOn(!isMuted())
    void fetchBranding().then(setBranding)
    setFavs(load(favKey))
    setHistory(load(histKey))
  }, [favKey, histKey])

  function toggleSound() {
    setSoundOn((on) => {
      const next = !on
      setMuted(!next)
      if (next) ensureAudio()
      return next
    })
  }

  const media: Media[] = useMemo(() => {
    if (!result?.found) return []
    const imgs = Array.from(new Set([result.image, ...(result.images ?? [])].filter(Boolean))) as string[]
    const list: Media[] = imgs.map((url) => ({ type: "image", url }))
    if (result.video_url) list.push({ type: "video", url: result.video_url })
    return list
  }, [result])

  const isFav = result ? favs.some((f) => f.id === idOf(result)) : false

  function pushHistory(r: PriceResult) {
    if (!r.found || !r.name) return
    const item: Saved = { id: idOf(r), name: r.name, price: r.price, image: r.image, barcode: r.barcode, at: Date.now() }
    setHistory((h) => {
      const next = [item, ...h.filter((x) => x.id !== item.id)].slice(0, 40)
      save(histKey, next)
      return next
    })
  }
  function toggleFav() {
    if (!result?.found || !result.name) return
    const item: Saved = { id: idOf(result), name: result.name, price: result.price, image: result.image, barcode: result.barcode, at: Date.now() }
    setFavs((f) => {
      const next = f.some((x) => x.id === item.id) ? f.filter((x) => x.id !== item.id) : [item, ...f]
      save(favKey, next)
      return next
    })
  }

  function showResult(r: PriceResult) {
    setSlide(0)
    setDragY(0)
    dragStart.current = null
    carousel.current?.scrollTo({ left: 0 })
    setResult(r)
    if (r.found) pushHistory(r)
  }
  function scanAgain() {
    setResult(null)
    setSheet(null)
    // Arrived from a shared link with no camera — "امسح منتج آخر" is the
    // moment the visitor actually asked for it.
    setCameraOn(true)
  }

  // Drag the sheet down past a threshold to close it.
  function onSheetDragStart(e: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = e.clientY
  }
  function onSheetDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStart.current == null) return
    const dy = e.clientY - dragStart.current
    setDragY(dy > 0 ? dy : 0)
  }
  function onSheetDragEnd() {
    if (dragStart.current == null) return
    dragStart.current = null
    setDragY((y) => {
      if (y > 110) scanAgain()
      return 0
    })
  }

  // Hero auto-scroll: glide through the images, stop at the video (so it never
  // scrolls into a playing clip), and stop the moment the customer takes over.
  useEffect(() => {
    const el = carousel.current
    if (!result?.found || !el || media.length <= 1) return
    el.scrollLeft = 0
    let i = 0
    let stopped = false
    const cancel = () => {
      stopped = true
      window.clearInterval(id)
    }
    el.addEventListener("pointerdown", cancel, { once: true, passive: true })
    const id = window.setInterval(() => {
      if (stopped) return window.clearInterval(id)
      i += 1
      if (i >= media.length) return window.clearInterval(id)
      el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
      if (media[i]?.type === "video") window.clearInterval(id)
    }, 2200)
    return () => {
      window.clearInterval(id)
      el.removeEventListener("pointerdown", cancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  async function handleCode(code: string): Promise<ScanFeedback> {
    try {
      const bc = code.trim()
      const r = await lookupBarcode(bc)
      logScan(bc, !!r.found) // silent background beacon — never awaited
      showResult(r)
      return r.found
        ? { ok: true, message: r.price ? `${r.name} — ${formatMoney(r.price)}` : (r.name ?? "تم") }
        : { ok: false, message: "غير موجود" }
    } catch {
      return { ok: false, message: "تعذر الاتصال" }
    }
  }

  /**
   * Open the shared product. If the lookup fails (barcode no longer stocked,
   * network down) we fall back to the scanner rather than stranding the
   * visitor on an empty screen.
   */
  useEffect(() => {
    if (!shared) return
    let cancelled = false
    void lookupBarcode(shared)
      .then((r) => {
        if (cancelled) return
        showResult(r)
        logScan(shared, !!r.found, "share")
      })
      .catch(() => {
        if (!cancelled) setCameraOn(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared])

  async function openSaved(s: Saved) {
    setSheet(null)
    if (s.barcode) {
      try {
        return showResult(await lookupBarcode(s.barcode))
      } catch {
        /* fall through to the stored snapshot */
      }
    }
    showResult({ found: true, name: s.name, price: s.price, image: s.image, barcode: s.barcode })
  }

  // Logged-in staff arrive at /price via the nav's scan button — show the app's
  // bottom nav so they can navigate away. Customers (no token) never see it.
  const [authed, setAuthed] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  useEffect(() => setAuthed(isAuthenticated()), [])

  const savedList = (sheet === "favs" ? favs : history).filter(
    (x) => typeof x.at === "number" && Date.now() - x.at < MAX_AGE_MS,
  )

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-ink">
      {/* Camera fills the screen; its own bottom bar holds flip/torch/photo + sound.
          For logged-in staff we leave room at the bottom for the app nav. */}
      <div className={authed ? "absolute inset-x-0 top-0 bottom-[6.5rem]" : "absolute inset-0"}>
        {cameraOn ? (
          <InlineScanner
            onDetect={handleCode}
            className="h-full w-full rounded-none"
            controls="bar"
            paused={!!result}
            silent={!soundOn}
            volume={0.9}
          >
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundOn ? "كتم الصوت" : "تفعيل الصوت"}
              className={cn(
                "grid size-12 place-items-center rounded-full shadow-lg backdrop-blur active:scale-90",
                soundOn ? "bg-primary text-white" : "bg-black/55 text-white",
              )}
            >
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
          </InlineScanner>
        ) : (
          /* Shared-link arrival: branded wait instead of a camera the visitor
             never asked for. Replaced by the result sheet a moment later. */
          <div className="grid h-full w-full place-items-center bg-ink">
            <BrandMark className="size-20 animate-pulse opacity-60" />
          </div>
        )}
      </div>

      {/* Top bar: store identity + history + favourites. */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2 rounded-full bg-black/45 py-1.5 pe-3 ps-1.5 text-white backdrop-blur">
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt="" className="size-7 rounded-full bg-white object-contain p-0.5" />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-white">
              <BrandMark className="size-5" />
            </span>
          )}
          <span className="max-w-[42vw] truncate text-sm font-bold">{branding?.name || "المتجر"}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Staff only: hand a customer this store's price-check QR.
              Hidden for walk-in visitors — they're already ON the page, so a
              "share this page" button would just be noise to them. */}
          {authed && (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              aria-label="مشاركة صفحة الأسعار"
              className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur active:scale-90"
            >
              <Share2 className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheet("history")}
            aria-label="السجل"
            className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur active:scale-90"
          >
            <Clock className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setSheet("favs")}
            aria-label="المفضلة"
            className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur active:scale-90"
          >
            <Heart className="size-5" />
          </button>
        </div>
      </div>

      {/* Idle hint — customers only. Logged-in staff already know how to scan,
          and the hint would sit on top of the camera controls (flip/torch/photo). */}
      {!result && !sheet && !authed && (
        <div className="absolute inset-x-0 bottom-24 z-10 flex justify-center">
          <p className="rounded-full bg-black/40 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur">
            وجّه الكاميرا نحو الباركود
          </p>
        </div>
      )}

      {/* Staff-only: the real app bottom nav so /price isn't a dead end for
          logged-in users. Customers never see it; hidden while a sheet is open. */}
      {authed && !result && !sheet && (
        <LockedFeatureProvider>
          <BottomNav />
        </LockedFeatureProvider>
      )}

      {/* Same QR dialog the app chrome uses — it encodes the CURRENT host, so
          each store shares its own price page with no per-tenant config. */}
      {authed && <PriceQrDialog open={qrOpen} onOpenChange={setQrOpen} />}

      {/* ── RESULT bottom sheet ─────────────────────────────────────── */}
      {result && (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={scanAgain}
            className="absolute inset-0 z-30 bg-black/45"
          />
          <div
            className="animate-in slide-in-from-bottom absolute inset-x-0 bottom-0 z-40 flex h-[74svh] flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl duration-300"
            style={{
              transform: dragY ? `translateY(${dragY}px)` : undefined,
              transition: dragStart.current == null ? "transform 0.25s ease" : "none",
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onSheetDragStart(e)
              }}
              onPointerMove={onSheetDragMove}
              onPointerUp={onSheetDragEnd}
              onPointerCancel={onSheetDragEnd}
            >
              <span className="h-1.5 w-12 rounded-full bg-muted-foreground/25" />
            </div>

            {result.found ? (
              <>
                {/* Hero media — edge to edge, auto-scroll, video is the last slide */}
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div
                    ref={carousel}
                    onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                    className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
                  >
                    {media.length === 0 ? (
                      <div className="grid w-full shrink-0 snap-center place-items-center p-6">
                        {branding?.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={branding.logo} alt="" className="max-h-full max-w-[60%] object-contain opacity-90" />
                        ) : (
                          <BrandMark className="size-28 opacity-80" />
                        )}
                      </div>
                    ) : (
                      media.map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex w-full shrink-0 snap-center items-center justify-center",
                            m.type === "image" ? "bg-white" : "bg-ink",
                          )}
                        >
                          {m.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <VideoPlayer url={m.url} fit="cover" className="h-full w-full" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {media.length > 1 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
                      {media.map((m, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            i === slide ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
                          )}
                        />
                      ))}
                      {media.some((m) => m.type === "video") && (
                        <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          فيديو ←
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Name + price together — the eye lands on both at once */}
                <div className="flex shrink-0 items-center gap-3 border-t border-black/5 px-4 pt-3">
                  <button
                    type="button"
                    onClick={toggleFav}
                    aria-label="المفضلة"
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-full border transition active:scale-90",
                      isFav ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <Heart className={cn("size-5", isFav && "fill-current")} />
                  </button>
                  {/* Everyone, customers included — this is the "send it to my
                      sister so she can see the price" button. */}
                  <ProductShareButton
                    product={{ name: result.name, price: result.price, barcode: result.barcode }}
                    className="shrink-0 border border-border bg-card text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-lg font-bold leading-snug break-words">{result.name}</p>
                    {result.price ? (
                      <p className="font-heading text-3xl font-extrabold leading-tight text-primary tabular-nums">
                        {formatMoney(result.price)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">اسأل الموظف عن السعر</p>
                    )}
                  </div>
                </div>

                {/* Scan again — bottom centre */}
                <div className="flex shrink-0 justify-center p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  <button
                    type="button"
                    onClick={scanAgain}
                    className="flex items-center gap-2 rounded-full bg-lime px-8 py-3.5 font-heading text-base font-bold text-lime-foreground shadow-lg shadow-lime/30 active:scale-95"
                  >
                    <RotateCcw className="size-5" /> مسح منتج آخر
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <X className="size-8" />
                </span>
                <p className="text-lg font-bold text-destructive">هذا المنتج غير موجود لدينا</p>
                <p className="text-sm text-muted-foreground">اسأل الموظف وسيساعدك 🌿</p>
                <button
                  type="button"
                  onClick={scanAgain}
                  className="mt-2 flex items-center gap-2 rounded-full bg-lime px-8 py-3.5 font-heading text-base font-bold text-lime-foreground shadow-lg shadow-lime/30 active:scale-95"
                >
                  <RotateCcw className="size-5" /> مسح منتج آخر
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Favourites / History bottom sheet ───────────────────────── */}
      {sheet && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="animate-in slide-in-from-bottom relative max-h-[82svh] rounded-t-[28px] bg-background p-4 shadow-2xl duration-200"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 px-1 pb-1 font-heading text-base font-bold">
                {sheet === "favs" ? (
                  <>
                    <Heart className="size-4 text-destructive" /> المفضلة
                  </>
                ) : (
                  <>
                    <Clock className="size-4" /> السجل
                  </>
                )}
              </p>
              <div className="max-h-[62svh] overflow-y-auto">
                {savedList.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {sheet === "favs" ? "لا مفضلات بعد — اضغط ❤ على أي منتج" : "لم تمسح أي منتج بعد"}
                  </p>
                ) : (
                  savedList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openSaved(s)}
                      className="flex w-full items-center gap-3 border-b border-black/5 py-3 text-start last:border-b-0"
                    >
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" className="size-12 shrink-0 rounded-2xl border object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted">
                          <Package className="size-5 text-muted-foreground" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                      {s.price ? (
                        <span className="shrink-0 font-heading text-sm font-bold text-primary tabular-nums">
                          {formatMoney(s.price)}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
