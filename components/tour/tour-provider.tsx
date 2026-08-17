"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Check, FlaskConical, X } from "lucide-react"

import { getTour, type Tour, type TourStep } from "@/lib/tour/tours"
import { startTourDemo, endTourDemo, markTourExit } from "@/lib/tour/demo"
import { isGuestDemo } from "@/lib/demo/guest"
import { cn } from "@/lib/utils"

type TourCtx = { startTour: (id: string) => void; active: boolean }
const Ctx = createContext<TourCtx>({ startTour: () => {}, active: false })
export function useTour() {
  return useContext(Ctx)
}

const CARD_W = 340
const CARD_H = 210 // fallback estimate until the card is measured
const GAP = 14
const TOP_SAFE = 56 // keep clear of the demo banner at the very top
/** Mobile: the fixed bottom nav (+ home indicator) the card must never cover. */
const BOTTOM_NAV_SAFE = 96
const MOBILE_MAX = 640

function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/**
 * Places the coach-mark in the largest free area around the spotlight so it
 * never covers the highlighted control and is always fully on-screen.
 */
function placeCard(
  rect: DOMRect | null,
  vw: number,
  vh: number,
  cardH: number = CARD_H,
): CSSProperties {
  const w = Math.min(CARD_W, vw - 2 * GAP)
  const isMobile = vw < MOBILE_MAX

  if (!rect) {
    return { left: "50%", top: "50%", width: w, transform: "translate(-50%, -50%)" }
  }

  // MOBILE: there is never room beside the spotlight, and the bottom nav is
  // fixed — so dock the card to whichever end has room, full width, and never
  // over the highlighted control or the nav. (Previously it could land on top
  // of both, which is what made the tour unusable on phones.)
  if (isMobile) {
    const roomBelow = vh - BOTTOM_NAV_SAFE - rect.bottom
    const roomAbove = rect.top - TOP_SAFE
    const dockTop = roomBelow < cardH + GAP && roomAbove > roomBelow
    return dockTop
      ? { left: GAP, right: GAP, top: TOP_SAFE, width: "auto" }
      : {
          left: GAP,
          right: GAP,
          bottom: BOTTOM_NAV_SAFE,
          width: "auto",
        }
  }

  const CARD_H = cardH // desktop math below uses the measured height
  const clampX = (x: number) => Math.min(Math.max(x, GAP), vw - w - GAP)
  const clampY = (y: number) =>
    Math.min(Math.max(y, TOP_SAFE), vh - CARD_H - GAP)
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const below = vh - rect.bottom
  const above = rect.top
  const right = vw - rect.right
  const left = rect.left
  // Prefer below / above (reads naturally); fall back to the sides; last resort
  // pin to the bottom centre.
  if (below >= CARD_H + GAP)
    return { left: clampX(cx - w / 2), top: rect.bottom + GAP, width: w }
  if (above >= CARD_H + GAP)
    return {
      left: clampX(cx - w / 2),
      top: Math.max(rect.top - CARD_H - GAP, TOP_SAFE),
      width: w,
    }
  if (right >= w + GAP)
    return { left: rect.right + GAP, top: clampY(cy - CARD_H / 2), width: w }
  if (left >= w + GAP)
    return { left: rect.left - w - GAP, top: clampY(cy - CARD_H / 2), width: w }
  return { left: clampX(cx - w / 2), bottom: GAP, width: w }
}

/**
 * Drives the interactive guided tours: enters the safe tour-demo sandbox,
 * navigates the real app page-to-page, spotlights the real controls with an
 * animated coach-mark, and advances on its own when the user actually performs
 * the highlighted action. If a step's anchor isn't on the page it degrades to a
 * centered card, so a tour is never broken by a missing element.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [tour, setTour] = useState<Tour | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const rectRef = useRef<DOMRect | null>(null)
  rectRef.current = rect

  const step: TourStep | null = tour ? (tour.steps[index] ?? null) : null

  // A tour only ever lives in React state, so on any fresh load no tour is
  // running yet. Clear a stale tour-demo flag left by an unclean exit so the
  // app always comes back to real data.
  useEffect(() => {
    endTourDemo()
  }, [])

  const startTour = useCallback(
    (id: string) => {
      const t = getTour(id)
      if (!t) return
      startTourDemo() // route every API call to the in-browser mock backend
      qc.clear() // swap the real cached data out for demo data
      setRect(null)
      setIndex(0)
      setTour(t)
    },
    [qc],
  )

  // Leaving the tour restores real data via a SOFT client navigation (not a
  // full reload) so a stale post-deploy JS chunk can't throw the browser's
  // black "couldn't load" page. We exit demo mode, drop the demo cache, and
  // open a short grace window so a stray 401 (token not yet refreshed) can't
  // log the user out (see inTourExitGrace + customFetch).
  //
  // Where you land depends on who you are and how the tour ended:
  // - Marketing visitor (guest demo): finishing keeps them RIGHT WHERE THEY
  //   ARE so they can keep playing with the feature they just learned;
  //   backing out early returns them to the homepage.
  // - Logged-in user: back to the /guide hub, as always.
  const finish = useCallback(
    (reason: "done" | "exit" = "exit") => {
      setTour(null)
      setRect(null)
      endTourDemo()
      markTourExit()
      qc.clear()
      if (isGuestDemo()) {
        if (reason === "exit") router.push("/")
        return
      }
      router.push("/guide")
    },
    [qc, router],
  )

  const goNext = useCallback(() => {
    if (!tour) return
    if (index + 1 >= tour.steps.length) finish("done")
    else {
      setRect(null)
      setIndex(index + 1)
    }
  }, [tour, index, finish])

  const goBack = useCallback(() => {
    if (index <= 0) return
    setRect(null)
    setIndex(index - 1)
  }, [index])

  // Stable refs so listeners created inside the tracking effect never go stale.
  const goNextRef = useRef(goNext)
  goNextRef.current = goNext
  const finishRef = useRef(finish)
  finishRef.current = finish

  // Navigate to the step's route, keep the spotlight glued to its anchor, and
  // auto-advance when the user performs the action.
  useEffect(() => {
    if (!tour || !step) return
    let cancelled = false
    let advanced = false
    let raf = 0
    let scrolled = false
    const startedAt = Date.now()
    if (step.route) router.push(step.route)

    function findEl(): HTMLElement | null {
      if (!step?.anchor) return null
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tour="${step.anchor}"]`),
      )
      for (const n of nodes) {
        const r = n.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return n
      }
      try {
        const sel = document.querySelector<HTMLElement>(step.anchor)
        if (sel && sel.getBoundingClientRect().width > 0) return sel
      } catch {
        /* not a selector */
      }
      return null
    }

    function loop() {
      if (cancelled) return
      const el = findEl()
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "center", inline: "center" })
          scrolled = true
        }
        const r = el.getBoundingClientRect()
        if (!sameRect(rectRef.current, r)) setRect(r)
      } else if (Date.now() - startedAt > 1400) {
        if (rectRef.current !== null) setRect(null)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Auto-advance: when the user actually clicks the action (a product tile,
    // the checkout button, …) or presses Enter, move to the next step. A small
    // delay lets the app handle the action first so the next anchor exists.
    const cleanups: Array<() => void> = []
    function advance() {
      if (advanced || cancelled) return
      advanced = true
      setTimeout(() => goNextRef.current(), 380)
    }
    if (step.advanceOn) {
      const sel = step.advanceOn
      const onClick = (e: MouseEvent) => {
        const t = e.target as Element | null
        if (t && t.closest(sel)) advance()
      }
      document.addEventListener("click", onClick, true)
      cleanups.push(() => document.removeEventListener("click", onClick, true))
    }
    if (step.advanceOnEnter) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter") advance()
      }
      window.addEventListener("keydown", onKey)
      cleanups.push(() => window.removeEventListener("keydown", onKey))
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      cleanups.forEach((c) => c())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, index])

  // Escape leaves; arrows step through.
  useEffect(() => {
    if (!tour) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        finishRef.current("exit")
      } else if (e.key === "ArrowLeft") {
        goNextRef.current() // RTL: left points "forward"
      } else if (e.key === "ArrowRight") {
        goBack()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tour, goBack])

  return (
    <Ctx.Provider value={{ startTour, active: !!tour }}>
      {children}
      {tour && step && (
        <TourOverlay
          rect={rect}
          step={step}
          index={index}
          total={tour.steps.length}
          onNext={goNext}
          onBack={goBack}
          onExit={() => finish("exit")}
        />
      )}
    </Ctx.Provider>
  )
}

function TourOverlay({
  rect,
  step,
  index,
  total,
  onNext,
  onBack,
  onExit,
}: {
  rect: DOMRect | null
  step: TourStep
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onExit: () => void
}) {
  const isLast = index + 1 >= total
  const PAD = 6
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  // Measure the REAL card height (Arabic copy wraps differently per step) so
  // placement never overlaps the spotlight because of a bad estimate.
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(CARD_H)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measure = () => setCardH(el.getBoundingClientRect().height || CARD_H)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [index, rect])
  const cardStyle = placeCard(rect, vw, vh, cardH)

  // Persistent "this is demo data" banner, always on top.
  const banner = (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[220] flex justify-center px-3">
      <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/10">
        <FlaskConical className="size-3.5 text-lime" />
        وضع تجريبي — بيانات وهمية للتدريب فقط، لا يُحفَظ أي شيء
      </div>
    </div>
  )

  const card = (
    <div
      ref={cardRef}
      dir="rtl"
      style={cardStyle}
      className="animate-in fade-in zoom-in-95 pointer-events-auto fixed z-[210] max-h-[70vh] overflow-y-auto rounded-3xl border border-border/60 bg-card p-4 shadow-2xl duration-200"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
          الخطوة {index + 1} من {total}
        </span>
        <button
          type="button"
          onClick={onExit}
          aria-label="إنهاء الجولة"
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
        >
          <X className="size-3.5" />
          خروج
        </button>
      </div>

      <h3 className="font-heading text-base font-bold">{step.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {step.body}
      </p>

      <div className="mt-3 flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-5 bg-primary" : "w-1.5 bg-muted",
            )}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/70"
          >
            <ArrowRight className="size-4" />
            السابق
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="bg-brand-gradient inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-95"
        >
          {isLast ? (
            <>
              إنهاء
              <Check className="size-4" />
            </>
          ) : (
            <>
              التالي
              <ArrowLeft className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )

  if (!rect) {
    return (
      <>
        {banner}
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-[1px]" />
          {card}
        </div>
      </>
    )
  }

  // Four dim panels around the target leave a clickable, highlighted hole.
  const panel = "fixed z-[200] bg-ink/65 backdrop-blur-[1px]"
  const top = Math.max(rect.top - PAD, 0)
  const bottom = rect.bottom + PAD
  const left = Math.max(rect.left - PAD, 0)
  const right = rect.right + PAD
  return (
    <>
      {banner}
      <div className={panel} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div className={panel} style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
      <div
        className={panel}
        style={{ top, left: 0, width: left, height: bottom - top }}
      />
      <div
        className={panel}
        style={{ top, left: right, right: 0, height: bottom - top }}
      />
      <div
        className="pointer-events-none fixed z-[205] rounded-2xl ring-2 ring-lime transition-all duration-200"
        style={{
          top,
          left,
          width: right - left,
          height: bottom - top,
          boxShadow: "0 0 0 3px color-mix(in oklab, var(--lime) 35%, transparent)",
        }}
      />
      {card}
    </>
  )
}
