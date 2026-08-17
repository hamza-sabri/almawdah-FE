"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { isAuthenticated } from "@/lib/tokens"
import { LANDING_MARKUP } from "./landing-markup"
import "./landing.css"

/**
 * Public marketing home. The visual design lives in landing-markup.ts +
 * landing.css (ported from the approved pharma-landing-v5 design, scoped under
 * #pharma-lp). This wrapper adds the app behaviour: send logged-in users
 * straight to the POS, and run the GSAP entrance/scroll choreography.
 */
export function Landing() {
  const router = useRouter()

  // Logged-in users never see the marketing home.
  useEffect(() => {
    if (isAuthenticated()) router.replace("/pos")
  }, [router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Scale each real-app iframe snapshot to fill its device frame.
    const observers: ResizeObserver[] = []
    function fit(shotId: string, natW: number, natH: number) {
      const el = document.getElementById(shotId)
      if (!el) return
      const f = el.querySelector("iframe") as HTMLIFrameElement | null
      if (!f) return
      const apply = () => {
        const w = el.clientWidth,
          h = el.clientHeight
        if (!w || !h) return
        const s = w / natW
        f.style.width = natW + "px"
        f.style.height = Math.max(natH, Math.ceil(h / s)) + "px"
        f.style.transform = "scale(" + s + ")"
      }
      apply()
      const ro = new ResizeObserver(apply)
      ro.observe(el)
      observers.push(ro)
    }
    fit("shot-mac", 1512, 800)
    fit("shot-iph", 430, 810)
    fit("bf-meds", 1512, 800)
    fit("bf-price", 1512, 800)

    if (reduce) {
      document.querySelectorAll<HTMLElement>(".rv").forEach((e) => (e.style.opacity = "1"))
      return () => observers.forEach((o) => o.disconnect())
    }

    gsap.registerPlugin(ScrollTrigger)

    // nav shadow + top progress bar
    const nav = document.getElementById("nav")
    const prog = document.getElementById("prog")
    const onScroll = () => {
      if (nav) nav.classList.toggle("sc", window.scrollY > 10)
      if (prog) {
        const p = window.scrollY / (document.body.scrollHeight - window.innerHeight)
        prog.style.width = p * 100 + "%"
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    const ctx = gsap.context(() => {
      // hero timeline (v5 choreography)
      const ws = gsap.utils.toArray<HTMLElement>("#h1 .w")
      gsap.set(ws, { opacity: 0 })
      gsap.set("#iph", { rotation: -8 })
      gsap.set(["#sub", "#cta", "#note", "#mac", "#iph", ".fcard"], { opacity: 0 })
      const tl = gsap.timeline({ delay: 0.15, defaults: { ease: "power3.out" } })
      tl.from("#eye", { y: 16, opacity: 0, duration: 0.5 })
        .to(ws, { opacity: 1, stagger: 0.1, duration: 0.05, ease: "none" })
        .to("#sub", { opacity: 1, duration: 0.5 }, "-=.2").from("#sub", { y: 16, duration: 0.5 }, "<")
        .to("#cta", { opacity: 1, duration: 0.5 }, "-=.3").from("#cta", { y: 16, duration: 0.5 }, "<")
        .to("#note", { opacity: 1, duration: 0.4 }, "-=.3")
        .to("#mac", { opacity: 1, duration: 0.6 }, "-=.9").from("#mac", { scale: 0.55, duration: 1, ease: "power4.out" }, "<")
        .to("#iph", { opacity: 1, duration: 0.5 }, "-=.7").from("#iph", { x: -160, y: 100, rotation: -24, duration: 1.05, ease: "power3.out" }, "<")
        .to(".fcard", { opacity: 1, stagger: 0.12, duration: 0.4 }, "-=.5").from(".fcard", { scale: 0.5, stagger: 0.12, duration: 0.4, ease: "back.out(2)" }, "<")
        .add(() => {
          gsap.to("#mac", { y: "-=12", duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1 })
          gsap.to("#iph", { y: "-=16", rotation: -8, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1 })
          gsap.to("#f1", { y: "-=8", duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 })
          gsap.to("#f2", { y: "-=8", duration: 2.7, ease: "sine.inOut", yoyo: true, repeat: -1 })
          const c = document.querySelector<HTMLElement>(".cur")
          if (c) c.style.display = "none"
        })

      // marquee
      const mt = document.getElementById("mtrack")
      if (mt) {
        mt.innerHTML += mt.innerHTML
        mt.innerHTML += mt.innerHTML
        gsap.to(mt, { xPercent: 25, duration: 26, ease: "none", repeat: -1 })
      }

      // scroll reveals
      gsap.utils.toArray<HTMLElement>(".rv").forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            delay: (i % 3) * 0.08,
            scrollTrigger: { trigger: el, start: "top 86%" },
          },
        )
      })

      // counters
      gsap.utils.toArray<HTMLElement>(".cnt").forEach((el) => {
        const to = +(el.dataset.to || "0")
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => {
            gsap.fromTo(
              el,
              { innerText: 0 },
              {
                innerText: to,
                duration: 1.8,
                ease: "power2.out",
                snap: { innerText: 1 },
                onUpdate: () => {
                  el.innerText = Math.round(+el.innerText).toLocaleString("en-US")
                },
              },
            )
          },
        })
      })

      // bars (bento debt + categories)
      gsap.utils.toArray<HTMLElement>(".deb .bar i, .crow .tr i").forEach((el) => {
        gsap.fromTo(
          el,
          { width: 0 },
          { width: el.dataset.w, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } },
        )
      })

      // donut
      const dcash = document.getElementById("dcash")
      if (dcash) {
        ScrollTrigger.create({
          trigger: dcash,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to("#dcash", { attr: { "stroke-dasharray": "535 540.35" }, duration: 1.6, ease: "power2.inOut" })
          },
        })
      }

      // flashy pricing tiers — pop in with a bounce, staggered
      gsap.from(".tiers .tier", {
        scrollTrigger: { trigger: ".tiers", start: "top 82%" },
        opacity: 0,
        scale: 0.82,
        y: 50,
        stagger: 0.14,
        duration: 0.75,
        ease: "back.out(1.6)",
      })

      // hero devices parallax
      gsap.to(".stage", {
        y: 60,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      })
    })

    return () => {
      window.removeEventListener("scroll", onScroll)
      observers.forEach((o) => o.disconnect())
      ctx.revert()
    }
  }, [])

  return <div id="pharma-lp" dangerouslySetInnerHTML={{ __html: LANDING_MARKUP }} />
}
