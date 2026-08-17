"use client"

import { useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Renders one of the static real-app snapshots (public/snap-*.html) inside a
 * scaled iframe — "show, don't tell" with the ACTUAL product UI.
 *
 * Anti-flicker measures:
 * - The box is sized by CSS aspect-ratio, so it never collapses or jumps.
 * - A soft skeleton sits underneath while the snapshot loads.
 * - The iframe itself starts invisible and FADES in only after its content
 *   has actually loaded — no white flash, no pop.
 * - Scale is computed in useLayoutEffect (before paint), so there is no
 *   zero-scale first frame.
 */
export function ProductShot({
  src,
  width = 1200,
  height = 760,
  className,
  rounded = "rounded-xl",
}: {
  src: string
  width?: number
  height?: number
  className?: string
  rounded?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  return (
    <div
      ref={ref}
      dir="ltr"
      className={cn("relative overflow-hidden bg-muted/60", rounded, className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-hidden="true"
    >
      {/* skeleton shimmer under the iframe */}
      <div
        className={cn(
          "absolute inset-0 animate-pulse bg-gradient-to-b from-muted/40 via-muted/70 to-muted/40 transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100",
        )}
      />
      {scale > 0 && (
        <iframe
          src={src}
          width={width}
          height={height}
          tabIndex={-1}
          loading="lazy"
          title=""
          onLoad={() => setLoaded(true)}
          className="transition-opacity duration-500"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: 0,
            pointerEvents: "none",
            display: "block",
            opacity: loaded ? 1 : 0,
          }}
        />
      )}
    </div>
  )
}
