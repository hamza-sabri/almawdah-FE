import {
  BadgeCheck,
  Database,
  FileUp,
  Lock,
  MessageCircle,
  ShieldCheck,
  Timer,
  Wifi,
} from "lucide-react"

import { SiteNav } from "@/components/marketing/site-nav"
import { SiteFooter } from "@/components/marketing/site-footer"
import { StatsSection } from "@/components/marketing/stats-section"
import { Reveal } from "@/components/marketing/reveal"
import { TryDemoButton } from "@/components/marketing/try-demo-button"
import { FearCards } from "@/components/marketing/fear-cards"
import { Mascot } from "@/components/marketing/mascot"
import { Hero } from "@/components/marketing/hero"
import { Marquee } from "@/components/marketing/marquee"
import { Story } from "@/components/marketing/story"
import { PricingSection } from "@/components/marketing/pricing-tiers"
import { WipeOverlay } from "@/components/marketing/page-transition"

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/"

/**
 * Landing v4 — a JOURNEY, not a demo:
 *
 *   1. Hero          — bold typographic promise + the real product, floating
 *   2. Marquee       — brand energy strip
 *   3. Story         — one working day on Pharma, scene by scene on a
 *                      scroll-drawn time rail (scrollytelling)
 *   4. Try it        — the fears grid: live the day yourself, guided
 *   5. Offer         — founding stores deal
 *   6. Trust         — support + privacy, condensed
 *
 * Page changes ride a GSAP curtain wipe (WipeOverlay) instead of popping.
 */

const SUPPORT = [
  { icon: MessageCircle, text: "خط واتساب مباشر مع المطوّر نفسه — رد خلال ساعة عمل، والطوارئ فوراً." },
  { icon: Wifi, text: "أي عطل ما بوقف البيع: الكاشير بشتغل بدون نت وبتزامن لما يرجع." },
  { icon: Timer, text: "أغلب المشاكل بتنحل عن بُعد بدقايق — بدون زيارة وبدون توقيف شغلك." },
  { icon: Database, text: "نسخة احتياطية كل ليلة، وتصدير كامل لبياناتك بأي وقت." },
]

const PRIVACY = [
  { icon: Lock, text: "كل صيدلية معزولة بالكامل — عزل مفحوص آلياً مع كل تحديث." },
  { icon: ShieldCheck, text: "بياناتك مشفرة وما منشاركها مع أي جهة كانت. نقطة." },
  { icon: BadgeCheck, text: "الموظفين بشوفوا بس اللي إنت سامحلهم فيه." },
  { icon: FileUp, text: "بتقدر تصدّر كل شي وتسكّر الحساب بأي لحظة — بياناتك إلك." },
]

export function Landing2() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <WipeOverlay />
      <SiteNav />

      <Hero whatsapp={WHATSAPP} />

      {/* breathing room under the floating stats band, then energy strip */}
      <div className="pt-20">
        <Marquee />
      </div>

      {/* ── Act I–VI: one day on Pharma ─────────────────────────────── */}
      <Story />

      {/* ── Now live it yourself ─────────────────────────────────────── */}
      <section id="demo" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 md:px-8 md:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-primary">دورك</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-[1.2] tracking-tight text-ink md:text-5xl">
              عيش هاليوم بنفسك.
              <br />
              ابدأ من اللي مخوّفك.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground md:text-lg">
              كل بطاقة بتفتح النظام الحقيقي على بيانات تجريبية، مع جولة إرشادية
              على نفس الشي اللي عندك خوف منه — بدون تسجيل، وما بتحفظ إشي.
            </p>
          </div>
          <Mascot say="اضغط أي بطاقة — وأنا بمشي معك خطوة خطوة!" className="hidden md:inline-flex" />
        </Reveal>
        <FearCards />
        <Reveal className="mt-12 flex justify-center">
          <TryDemoButton label="أو افتح النظام كامل وتصفّح براحتك" variant="ink" size="md" />
        </Reveal>
      </section>

      {/* ── Live platform numbers (auto-hidden when empty) ───────────── */}
      <StatsSection className="pb-24" />

      {/* ── Pricing (tiers + contact) then the wide calculator section ── */}
      <PricingSection />

      {/* ── Founding offer ───────────────────────────────────────────── */}
      <section id="offer" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 md:px-8">
        <Reveal>
          <div className="ink-panel grid items-center gap-10 rounded-[2.5rem] p-8 md:grid-cols-[1.3fr_1fr] md:p-16">
            <div>
              <span className="pill pill-lime text-xs font-bold">عرض التأسيس — لأول ٥ صيدليات</span>
              <h2 className="mt-5 max-w-xl text-3xl font-extrabold leading-[1.25] tracking-tight text-white md:text-5xl">
                خصم ٥٠٪ أول سنة،
                <br />
                وسعر مثبّت ٣ سنين.
              </h2>
              <p className="mt-5 max-w-lg leading-relaxed text-white/70">
                مع نقل بياناتك من نظامك الحالي مجاناً (قيمتها ١٠٠٠ شيكل)، وتدريب
                كل الموظفين بالمحل، و٦٠ يوم تجربة والنظامين شغالين جنب بعض — ما
                عجبك؟ مصاريك بترجعلك كاملة.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 md:items-end">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-lime px-7 text-base font-bold text-lime-foreground shadow-lg shadow-lime/20 transition hover:brightness-95"
              >
                <MessageCircle className="size-5" />
                احجز مكانك — واتساب مباشر
              </a>
              <TryDemoButton label="أو جرّب النظام الأول" variant="white" size="md" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── The two quiet objections, answered in writing ────────────── */}
      <section id="support" className="border-t border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 md:grid-cols-2 md:px-8">
          <Reveal>
            <p className="text-sm font-bold text-primary">الدعم</p>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">«وإذا علق النظام؟»</h3>
            <ul className="mt-6 space-y-4">
              {SUPPORT.map((s) => (
                <li key={s.text} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <s.icon className="size-4 text-primary" />
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-sm font-bold text-primary">الخصوصية</p>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">«مين بشوف بياناتي؟»</h3>
            <ul className="mt-6 space-y-4">
              {PRIVACY.map((p) => (
                <li key={p.text} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <p.icon className="size-4 text-primary" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
