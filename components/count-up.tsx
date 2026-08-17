"use client"

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

type CountUpProps = {
  value: number
  /** Number of fraction digits. */
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
      if (reduce) {
        el.textContent = `${prefix}${fmt(value)}${suffix}`
        return
      }
      const obj = { n: 0 }
      gsap.to(obj, {
        n: value,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = `${prefix}${fmt(obj.n)}${suffix}`
        },
      })
    },
    { dependencies: [value], scope: ref },
  )

  return (
    <span ref={ref} className={className}>
      {`${prefix}${fmt(value)}${suffix}`}
    </span>
  )
}
