"use client"

import { type RefObject } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

/**
 * Signature entrance: cards pop in one after another with a small bounce.
 * Runs only once the data is ready (`ready` flips to true) so the tween can
 * never be killed mid-flight by a re-render — and `clearProps` removes the
 * inline transforms afterwards so hover lifts keep working.
 */
export function useStaggerCards(
  scope: RefObject<HTMLElement | null>,
  selector: string,
  ready: unknown,
  deps: unknown[] = [],
) {
  useGSAP(
    () => {
      if (!ready) return
      const targets = gsap.utils.toArray<HTMLElement>(selector)
      if (targets.length === 0) return
      gsap.fromTo(
        targets,
        { y: 26, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.055,
          ease: "back.out(2)",
          overwrite: "auto",
          clearProps: "transform,opacity",
        },
      )
    },
    { scope, dependencies: [Boolean(ready), ...deps] },
  )
}
