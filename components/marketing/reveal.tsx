"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

/**
 * Scroll-into-view reveal (GSAP + IntersectionObserver — no ScrollTrigger
 * plugin needed). Respects prefers-reduced-motion. With `stagger`, the direct
 * children animate one after another.
 */
export function Reveal({
  children,
  className,
  stagger = false,
  y = 24,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  stagger?: boolean
  y?: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const targets: Element[] = stagger ? Array.from(el.children) : [el]
    if (targets.length === 0) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      gsap.set(targets, { opacity: 1, y: 0 })
      return
    }

    gsap.set(targets, { opacity: 0, y })
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          gsap.to(targets, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay,
            stagger: stagger ? 0.08 : 0,
            ease: "power3.out",
            clearProps: "transform",
          })
          obs.unobserve(entry.target)
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [stagger, y, delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
