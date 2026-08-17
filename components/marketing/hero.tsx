"use client"

import { useEffect, useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Check, FileUp, MessageCircle, Package, ShieldCheck, Timer } from "lucide-react"

import { TryDemoButton } from "@/components/marketing/try-demo-button"
import { ProductShot } from "@/components/marketing/product-shot"

/**
 * Hero.
 * - Line 1 staggers in word by word; line 2 is a looping typewriter.
 *   The typewriter renders on top of an INVISIBLE copy of the longest
 *   phrase, so the layout never reflows while it types (no page jumping).
 * - CatalogItem entrance: clip + blur + scale reveal (no dated side-slide),
 *   then a cursor-parallax tilt (desktop) and an endless gentle float.
 */

const TYPED_LINE = "فارما بحكيلك شو تعمل بكرة."

/**
 * Types the line out ONCE on first load (no endless looping), then the caret
 * blinks for a moment and fades away. Space is reserved by an invisible copy
 * of the full line so nothing ever reflows.
 */
function useTypeOnce(full: string) {
  const [text, setText] = useState("")
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(full)
      setDone(true)
      return
    }
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      i++
      setText(full.slice(0, i))
      if (i >= full.length) {
        t = setTimeout(() => setDone(true), 2200) // caret lingers, then fades
        return
      }
      t = setTimeout(tick, 52)
    }
    t = setTimeout(tick, 850) // start after the first line lands
    return () => clearTimeout(t)
  }, [full])
  return { text, done }
}

export function Hero({ whatsapp }: { whatsapp: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { text: typed, done: typedDone } = useTypeOnce(TYPED_LINE)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduce) return

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.from(".h-kicker", { y: 16, opacity: 0, duration: 0.5 })
        .from(".h-word", { y: 34, opacity: 0, duration: 0.55, stagger: 0.07 }, "-=0.25")
        .from(".h-sub", { y: 20, opacity: 0, duration: 0.5 }, "-=0.2")
        .from(".h-cta", { y: 16, opacity: 0, scale: 0.92, duration: 0.45, stagger: 0.08, ease: "back.out(1.8)" }, "-=0.2")
        .from(".h-checks", { opacity: 0, duration: 0.5 }, "-=0.1")
        // modern reveal: unmask + unblur + settle (no side-slide)
        .fromTo(
          ".h-browser",
          { clipPath: "inset(0% 0% 100% 0% round 16px)", filter: "blur(14px)", scale: 1.06 },
          { clipPath: "inset(0% 0% 0% 0% round 16px)", filter: "blur(0px)", scale: 1, duration: 0.9, ease: "power4.out" },
          0.3,
        )
        .fromTo(
          ".h-phone",
          { y: 60, opacity: 0, scale: 0.8, filter: "blur(8px)" },
          { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.65, ease: "back.out(1.5)" },
          "-=0.45",
        )
        .from(".h-stats", { y: 44, opacity: 0, duration: 0.6, ease: "back.out(1.4)" }, "-=0.3")

      // Endless gentle float
      gsap.to(".h-browser", { y: -8, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 })
      gsap.to(".h-phone", { y: -12, rotate: -1.2, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.6 })

      // Cursor parallax tilt (fine pointers only)
      const visual = el.querySelector<HTMLElement>(".h-visual")
      if (visual && window.matchMedia("(pointer: fine)").matches) {
        gsap.set(visual, { transformPerspective: 1100 })
        const toRY = gsap.quickTo(visual, "rotationY", { duration: 0.7, ease: "power3.out" })
        const toRX = gsap.quickTo(visual, "rotationX", { duration: 0.7, ease: "power3.out" })
        const onMove = (e: MouseEvent) => {
          const r = visual.getBoundingClientRect()
          const nx = ((e.clientX - r.left) / r.width - 0.5) * 2
          const ny = ((e.clientY - r.top) / r.height - 0.5) * 2
          toRY(nx * 7)
          toRX(-ny * 5)
        }
        const onLeave = () => {
          toRY(0)
          toRX(0)
        }
        el.addEventListener("mousemove", onMove)
        el.addEventListener("mouseleave", onLeave)
        return () => {
          el.removeEventListener("mousemove", onMove)
          el.removeEventListener("mouseleave", onLeave)
        }
      }
    },
    { scope: ref },
  )

  const line1 = "نظامك بسجّل شو صار."

  return (
    <section ref={ref} className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute -start-40 -top-40 size-[480px] rounded-full bg-primary/10 blur-3xl" />
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 pb-20 pt-14 md:grid-cols-[1.1fr_1fr] md:px-14 md:pb-28 md:pt-20 lg:gap-24 lg:px-20">
        <div>
          <p className="h-kicker text-sm font-bold text-primary">نظام إدارة صيدليات — عربي أولاً</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.22] tracking-tight md:text-5xl lg:text-[3.6rem] lg:leading-[1.18]">
            <span className="block">
              {line1.split(" ").map((w, i) => (
                <span key={i} className="h-word inline-block whitespace-pre">
                  {w}{" "}
                </span>
              ))}
            </span>
            {/* Layout-locked type-once: invisible full line reserves the exact
                space; the typed text paints on top. Zero reflow, ever. */}
            <span className="relative mt-1 block" dir="rtl">
              <span className="invisible" aria-hidden="true">
                {TYPED_LINE}
              </span>
              <span className="text-gradient absolute inset-0">
                {typed}
                <span
                  className={`-ms-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-primary align-baseline transition-opacity duration-700 ${
                    typedDone ? "opacity-0" : "animate-pulse"
                  }`}
                />
              </span>
            </span>
          </h1>
          <p className="h-sub mt-6 max-w-lg text-base leading-[1.9] text-muted-foreground md:text-lg">
            نقطة بيع، مخزون، ديون، وتقارير بتلاقيلك مصاري — مبني على بيانات
            صيدليات حقيقية من الضفة، وبشتغل حتى لما يقطع الإنترنت.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="h-cta inline-flex">
              <TryDemoButton label="جرّب النظام كامل — بدون تسجيل" />
            </span>
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="h-cta inline-flex items-center gap-1.5 text-sm font-bold text-foreground underline-offset-4 transition hover:text-primary hover:underline"
            >
              <MessageCircle className="size-4" />
              أو كلّمنا واتساب
            </a>
          </div>
          <p className="h-checks mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-success" /> بدون تسجيل أو بطاقة</span>
            <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-success" /> بيانات تجريبية — ما بتحفظ إشي</span>
            <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-success" /> يعمل بدون إنترنت</span>
          </p>
        </div>

        {/* Real product with cursor-parallax tilt */}
        <div className="h-visual relative will-change-transform">
          <div className="hidden md:block">
            <div className="h-browser overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-primary/10 will-change-transform">
              <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-destructive/50" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
              </div>
              <ProductShot src="/snap-dashboard.html" width={1200} height={720} rounded="rounded-none" />
            </div>
            <div className="h-phone absolute -bottom-8 -start-4 w-[168px] overflow-hidden rounded-[1.6rem] border-[5px] border-ink bg-ink shadow-2xl will-change-transform">
              <ProductShot src="/snap-pos-mobile.html" width={390} height={700} rounded="rounded-[1.2rem]" />
            </div>
          </div>
          <div className="md:hidden">
            <div className="h-phone mx-auto w-[240px] overflow-hidden rounded-[2rem] border-[6px] border-ink bg-ink shadow-xl">
              <ProductShot src="/snap-pos-mobile.html" width={390} height={640} rounded="rounded-[1.6rem]" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating stats band */}
      <div className="relative z-10 mx-auto -mb-10 max-w-5xl px-4 md:px-6">
        <div className="h-stats grid grid-cols-2 gap-y-6 rounded-3xl border border-border/60 bg-card p-6 shadow-xl shadow-primary/5 md:grid-cols-4 md:p-8">
          {[
            { icon: FileUp, value: "٢٬٨٩٠+", label: "فاتورة حقيقية مستوردة من نظام قديم" },
            { icon: Package, value: "~٢٢٬٠٠٠", label: "صنف نُقل بدقة الباركود" },
            { icon: Timer, value: "٦٠ يوم", label: "تجربة والنظامان شغالين جنب بعض" },
            { icon: ShieldCheck, value: "٪١٠٠", label: "بياناتك قابلة للتصدير بأي لحظة" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3.5 px-2">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10">
                <s.icon className="size-5 text-primary" />
              </span>
              <div>
                <div className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">{s.value}</div>
                <p className="mt-0.5 max-w-[170px] text-[11px] leading-snug text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
