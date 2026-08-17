"use client"

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Pill, Printer, ScanBarcode, ShoppingBag, WifiOff } from "lucide-react"

const TILES = [
  { name: "بنادول إكسترا", price: "12.00" },
  { name: "فيتامين د ١٠٠٠", price: "18.50" },
  { name: "أموكسيسيلين", price: "9.00" },
  { name: "كمادات باردة", price: "5.00" },
]

/** Animated "app preview" for the hero — a stylised POS window that gently
 *  floats, with feature chips popping in around it. Pure CSS/SVG + GSAP (no
 *  Three.js) so it's light and never blocks the build. */
export function HeroVisual() {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      // Entrance
      gsap.from(".hv-card", {
        opacity: 0,
        y: 34,
        scale: 0.95,
        duration: 0.8,
        ease: "power3.out",
      })
      gsap.from(".hv-tile", {
        opacity: 0,
        y: 16,
        stagger: 0.08,
        delay: 0.35,
        duration: 0.5,
        ease: "power2.out",
      })
      gsap.from(".hv-chip", {
        opacity: 0,
        scale: 0.6,
        stagger: 0.12,
        delay: 0.5,
        duration: 0.55,
        ease: "back.out(2.2)",
      })
      if (reduce) return
      // Idle float
      gsap.to(".hv-card", {
        y: -10,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      })
      gsap.to(".hv-chip", {
        y: -9,
        duration: 2.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.3,
      })
    },
    { scope },
  )

  return (
    <div ref={scope} className="relative mx-auto w-full max-w-md">
      <div className="bg-brand-gradient absolute -inset-8 -z-10 rounded-[3rem] opacity-20 blur-3xl" />

      {/* POS window mock */}
      <div className="hv-card overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-2xl shadow-ink/25">
        <div className="ink-panel flex items-center justify-between rounded-none px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <ShoppingBag className="size-4 text-lime" />
            <span className="font-heading text-sm font-bold">نقطة البيع</span>
          </div>
          <span className="pill bg-white/10 px-2.5 py-1 text-[10px] text-white/80">
            مبيعات اليوم ٣٤٠ ₪
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-4">
          {TILES.map((t) => (
            <div
              key={t.name}
              className="hv-tile rounded-2xl border bg-background/60 p-3"
            >
              <span className="bg-brand-soft mb-2 grid size-8 place-items-center rounded-xl">
                <Pill className="size-4 text-primary/70" />
              </span>
              <p className="truncate text-xs font-medium">{t.name}</p>
              <p className="font-heading text-sm font-bold text-primary">
                {t.price} ₪
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground">الإجمالي</p>
            <p className="font-heading text-xl font-extrabold text-ink">44.50 ₪</p>
          </div>
          <span className="bg-lime text-lime-foreground shadow-lime/30 inline-flex h-10 items-center gap-2 rounded-2xl px-5 text-sm font-bold shadow-lg">
            <ShoppingBag className="size-4" />
            إتمام البيع
          </span>
        </div>
      </div>

      {/* Floating feature chips */}
      <div className="hv-chip absolute -end-3 top-10 flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold shadow-lg ring-1 ring-border">
        <Printer className="size-4 text-primary" /> طباعة فورية
      </div>
      <div className="hv-chip absolute -start-4 top-1/3 flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-bold text-white shadow-lg">
        <WifiOff className="size-4 text-lime" /> يعمل بدون إنترنت
      </div>
      <div className="hv-chip absolute -start-2 bottom-10 flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold shadow-lg ring-1 ring-border">
        <ScanBarcode className="size-4 text-primary" /> مسح باركود
      </div>
    </div>
  )
}
