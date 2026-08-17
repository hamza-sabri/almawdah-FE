"use client"

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

import { cn } from "@/lib/utils"

/**
 * "فارمي" v2 — the Pharma capsule mascot, redrawn: clean symmetric capsule
 * with a gradient, glossy highlight, big friendly eyes, and a tiny waving
 * hand that doesn't cross the face. GSAP idle loop: bob, blink, wave.
 * Inline SVG so it always matches the palette and can't 404.
 */
export function Mascot({
  say,
  className,
  size = 88,
  flip = false,
}: {
  say?: string
  className?: string
  size?: number
  flip?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

      gsap.to(el.querySelector(".m-svg"), {
        y: -5,
        duration: 1.9,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      })
      const blink = gsap.timeline({ repeat: -1, repeatDelay: 2.8, delay: 1.4 })
      blink
        .to(el.querySelectorAll(".m-eye"), { scaleY: 0.1, transformOrigin: "center", duration: 0.07 })
        .to(el.querySelectorAll(".m-eye"), { scaleY: 1, duration: 0.1 })
      gsap.to(el.querySelector(".m-hand"), {
        rotate: 22,
        transformOrigin: "bottom center",
        duration: 0.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 3,
        repeatDelay: 0.05,
        delay: 0.8,
      })
      const bubble = el.querySelector(".m-bubble")
      if (bubble) {
        gsap.from(bubble, {
          scale: 0.7,
          opacity: 0,
          y: 6,
          duration: 0.45,
          delay: 0.4,
          ease: "back.out(2)",
          transformOrigin: flip ? "bottom left" : "bottom right",
        })
      }
    },
    { scope: ref },
  )

  return (
    <div
      ref={ref}
      className={cn("pointer-events-none relative inline-flex items-end gap-2.5", flip && "flex-row-reverse", className)}
      aria-hidden="true"
    >
      {say && (
        <div className="m-bubble relative mb-9 max-w-[210px] rounded-2xl bg-ink px-4 py-2.5 text-xs font-bold leading-relaxed text-white shadow-lg">
          {say}
          <span className={cn("absolute -bottom-1.5 size-3 rotate-45 bg-ink", flip ? "left-5" : "right-5")} />
        </div>
      )}
      <svg
        className="m-svg"
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        style={flip ? { transform: "scaleX(-1)" } : undefined}
      >
        <defs>
          <linearGradient id="mCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CFC" />
            <stop offset="100%" stopColor="#5B5CE2" />
          </linearGradient>
        </defs>
        {/* ground shadow */}
        <ellipse cx="48" cy="90" rx="20" ry="3.5" fill="#201F38" opacity="0.10" />
        {/* capsule */}
        <rect x="27" y="8" width="42" height="78" rx="21" fill="url(#mCap)" />
        <path d="M27 47h42v18a21 21 0 0 1-21 21 21 21 0 0 1-21-21V47Z" fill="#D8F55A" />
        {/* seam + gloss */}
        <rect x="27" y="45.6" width="42" height="2.8" rx="1.4" fill="#201F38" opacity="0.14" />
        <ellipse cx="37" cy="20" rx="5" ry="9" fill="white" opacity="0.28" transform="rotate(18 37 20)" />
        {/* eyes */}
        <g className="m-eye">
          <circle cx="40.5" cy="30" r="4.6" fill="white" />
          <circle cx="41.6" cy="31" r="2.2" fill="#201F38" />
          <circle cx="39.4" cy="28.6" r="1" fill="white" opacity="0.9" />
        </g>
        <g className="m-eye">
          <circle cx="56" cy="30" r="4.6" fill="white" />
          <circle cx="57.1" cy="31" r="2.2" fill="#201F38" />
          <circle cx="54.9" cy="28.6" r="1" fill="white" opacity="0.9" />
        </g>
        {/* smile + cheeks */}
        <path d="M42.5 38.5c2.2 2.4 9 2.4 11.2 0" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="34.5" cy="35.5" r="2.1" fill="#ff9db5" opacity="0.7" />
        <circle cx="61.5" cy="35.5" r="2.1" fill="#ff9db5" opacity="0.7" />
        {/* waving hand — beside the body, never over the face */}
        <g className="m-hand">
          <rect x="70" y="30" width="7" height="16" rx="3.5" fill="#5B5CE2" />
          <circle cx="73.5" cy="28" r="4.5" fill="#7C5CFC" />
        </g>
        {/* resting hand */}
        <rect x="19" y="52" width="7" height="14" rx="3.5" fill="#b6cf3f" />
        {/* feet */}
        <ellipse cx="40" cy="86.5" rx="5" ry="2.6" fill="#b6cf3f" />
        <ellipse cx="56" cy="86.5" rx="5" ry="2.6" fill="#b6cf3f" />
      </svg>
    </div>
  )
}
