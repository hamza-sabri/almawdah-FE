"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import gsap from "gsap"

import { BrandMark } from "@/components/brand"

/**
 * Page-wipe transitions (barba.js-style, but App-Router-native).
 *
 * barba.js targets classic multi-page sites and can't drive Next's client
 * router, so we do the same choreography with GSAP: an ink curtain sweeps up
 * and covers the screen, THEN we navigate — so the route change happens while
 * the viewport is covered and the user never sees a hard "pop". On arrival
 * back at the landing, the curtain reveals upward.
 *
 * Usage: render <WipeOverlay /> once on the page, navigate with wipeTo(href).
 */

const EVENT = "pharma:wipe"
const ARRIVAL_KEY = "pharma_wipe_arrival"

export function wipeTo(href: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: href }))
}

export function WipeOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const busy = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Arrival reveal: if we landed here through a wipe, start covered and
    // sweep the curtain away.
    try {
      if (sessionStorage.getItem(ARRIVAL_KEY) === "1") {
        sessionStorage.removeItem(ARRIVAL_KEY)
        if (!reduce) {
          gsap.set(el, { yPercent: 0 })
          gsap.to(el, { yPercent: -100, duration: 0.6, delay: 0.15, ease: "power3.inOut" })
        }
      }
    } catch {
      /* ignore */
    }

    const onWipe = (e: Event) => {
      const href = (e as CustomEvent<string>).detail
      if (!href || busy.current) return
      busy.current = true
      try {
        sessionStorage.setItem(ARRIVAL_KEY, "1")
      } catch {
        /* ignore */
      }
      if (reduce) {
        router.push(href)
        return
      }
      gsap.fromTo(
        el,
        { yPercent: 100 },
        {
          yPercent: 0,
          duration: 0.5,
          ease: "power3.inOut",
          onComplete: () => router.push(href),
        },
      )
      gsap.fromTo(
        el.querySelector(".wipe-brand"),
        { y: 26, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, delay: 0.22, ease: "back.out(1.8)" },
      )
    }

    window.addEventListener(EVENT, onWipe)
    return () => window.removeEventListener(EVENT, onWipe)
  }, [router])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center bg-ink"
      style={{ transform: "translateY(100%)" }}
    >
      <div className="wipe-brand flex flex-col items-center gap-3">
        <BrandMark className="size-14" />
        <span className="text-sm font-bold text-white/70">فارما</span>
      </div>
    </div>
  )
}
